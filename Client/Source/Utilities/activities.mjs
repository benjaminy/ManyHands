/* Top Matter */

"use strict";

import assert from "./assert";
const P = Promise;

/* A promise that immediately resolves.  Gives the scheduler a chance to switch. */
const yieldP = () => ( new Promise( setImmediate ) );

const ATOMICIFY_TAG   = Symbol( "atomicify" );
const SCHEDULER_TAG   = Symbol( "scheduler" );
const CONTINUE_TAG    = Symbol( "continue" );
const ABORT_TAG       = Symbol( "abort" );
const WAITS_TAG       = Symbol( "waits" );
const CALL_STACK_TAG  = Symbol( "call_stack" );
const ID_TAG          = Symbol( "id" );
const STATE_TAG       = Symbol( "state" );
const PARENT_TAG      = Symbol( "parent" );
const RUNNABLE        = Object.freeze( { t: STATE_TAG } );
const RUNNING         = Object.freeze( { t: STATE_TAG } );
const WAITING         = Object.freeze( { t: STATE_TAG } );
const RESOLVING       = Object.freeze( { t: STATE_TAG } );
const GENERATOR_ERROR = Object.freeze( { t: STATE_TAG } );
const FINISHED        = Object.freeze( { t: STATE_TAG } );

const scheduler =
    {
        all_actxs           : {},
        active_actxs        : new Set( [] ),
        num_activities      : 0,
        atomic_stack        : []
    };

/* The global context is syntactically like a regular activity context,
 * but it never resolves. */
const global_context = new Promise( function() {} );
makeContext( global_context, null );
global_context[ SCHEDULER_TAG ] = scheduler;

var current_context = global_context;

/* "prelude" is a convenience function */
function prelude()
{
    const actx = current_context;
    assert( isContext( actx ) );
    const scheduler = actx[ SCHEDULER_TAG ];
    // assert( sched.active_actxs.has( actx[ ID_TAG ] ) );
    const atomic_stack = scheduler.atomic_stack;
    return [ actx, scheduler, atomic_stack ];
}

/* Reminder: f can't be an async function, because current_context needs
 * to be set after every yield/await. */
/* Reminder: It would be a neat convenience if atomicified functions
 * could be called as regular async functions.  This seems to mess with
 * the global variable hack. */
function atomicify( f )
{
    assert( f ? true : false );
    /* assert( f is generator function ) */
    if( ATOMICIFY_TAG in f )
        return f;

    async function stepper( ...params )
    {
        const [ actx, scheduler, atomic_stack ] = prelude();
        const call_stack = actx[ CALL_STACK_TAG ];
        var gen_temp;
        try {
            gen_temp = f( ...params );
            if( !( typeof gen_temp[ Symbol.iterator ] === "function" ) )
                throw {};
        }
        catch( err ) {
            throw new Error( "atomicify needs generator function. " + typeof( f ) );
        }
        const generator = gen_temp;
        // console.log( "ATOMICIFY : STEPPER : CALL_STACK PUSH", f.name, call_stack.length );
        call_stack.push( [ f, generator ] );

        function blockedByAtomic()
        {
            const not_blocked = ( atomic_stack.length < 1 )
                  || ( scheduler.active_actxs.has( actx[ ID_TAG ] ) );
            return !not_blocked;
        }

        try {
            var val = undefined; /* 1st call to .next doesn't need a val */
            var is_err = false;
            /* implicit yield before calls: */
            await yieldP();
            while( true ) /* return/throw in loop */
            {
                // console.log( "STEPPER LOOP", f.name, call_stack.length );
                const blocks = []; /* TODO: stats about blocking */
                while( blockedByAtomic() )
                {
                    /* assert( actx not in scheduler.waiting_activities ); */
                    const top = atomic_stack[ atomic_stack.length - 1 ];
                    actx[ STATE_TAG ] = WAITING;
                    actx[ WAITS_TAG ]++;
                    actx[ QUEUE_LEN_TAG ] = top.waiting.length;
                    top.waiting.add( actx );
                    blocks.push( await ( new Promise( function( resolve, reject ) {
                        actx[ CONTINUE_TAG ] = resolve;
                        actx[ ABORT_TAG ]    = reject;
                    } ) ) );
                }

                current_context = actx;
                if( is_err )
                    var generated = generator.throw( val );
                else
                    var generated = generator.next( val );

                if( generated.done )
                    return generated.value;

                try {
                    val = await generated.value;
                    is_err = false;
                }
                catch( err ) {
                    val = err;
                    is_err = true;
                }
            }
        }
        finally {
            assert( call_stack.length > 0 );
            // console.log( "MERP", call_stack.length, generator );
            const [ fa, ga ] = call_stack.pop();
            // console.log( "DERP", f.name, fa.name, ga === generator );
            assert( ga === generator );
            assert( fa === f );
        }
    }

    stepper[ ATOMICIFY_TAG ] = undefined;
    return stepper;
}

function makeContext( child, parent )
{
    /* assert( child is Promise ) */
    assert( parent === null || isContext( parent ) );
    child[ CONTINUE_TAG ]   = null;
    child[ ABORT_TAG ]      = null;
    child[ WAITS_TAG ]      = 0;
    child[ CALL_STACK_TAG ] = [];
    child[ SCHEDULER_TAG ]  = parent ? parent[ SCHEDULER_TAG ] : scheduler;
    child[ ID_TAG ]         = Symbol( "activity_id" );
    child[ STATE_TAG ]      = RUNNABLE;
    child[ PARENT_TAG ]     = parent;
}

function activateOpts( options )
{
/* activate is an async function to force its caller to yield to get the
 * current_context set correctly. */
return async function activate( ...params_plus_f )
{
    const [ parent, sched, atomic_stack ] = prelude();
    console.log( "activate" );
    var horses;
    const hold_your_horses = new Promise( ( r ) => { horses = r; } );
    const child = async function()
    {
        await hold_your_horses;
        assert( isContext( child ) );
        sched.active_actxs.add( child[ ID_TAG ] );
        current_context = child;
        try {
            const params = params_plus_f.slice( 0, params_plus_f.length - 1 );
            const fn     = atomicify( params_plus_f[ params_plus_f.length - 1 ] );
            return await fn( ...params );
        }
        finally {
            /* XXX what about atomic stuff??? */
            child[ STATE_TAG ] = FINISHED;
            const id = child[ ID_TAG ];
            assert( id in sched.all_actxs );
            assert( sched.active_actxs.has( id ) );
            delete sched.all_actxs[ id ];
            sched.active_actxs.delete( id );
            sched.num_activities--;
            assert( Object.getOwnPropertySymbols( sched.all_actxs ).length === sched.num_activities );
            console.log( id, sched.num_activities );
        }
    } ();

    makeContext( child, parent );
    sched.all_actxs[ child[ ID_TAG ] ] = child;
    sched.num_activities++;
    console.log( "ACTIVATE", Object.getOwnPropertySymbols( sched.all_actxs ).length, sched.num_activities );
    assert( Object.getOwnPropertySymbols( sched.all_actxs ).length === sched.num_activities );
    var delay_start = false;
    if( atomic_stack.length > 0 )
    {
        /* XXX More cases */
        atomic_stack[ atomic_stack.length - 1 ].peers.add( child );
        delay_start = true;
    }
    horses( delay_start );

    /* Wrapping the child Promise an a 1-element array, because of the weird */
    return [ child ];
}
}

const activate = activateOpts( {} );
const activateShortLived = activateOpts( { "short-lived":true } );

function atomicOpts( options )
{
return async function atomic( ...params_plus_fn )
{
    const [ parent, sched, atomic_stack ] = prelude();
    console.log( "atomic" );

    const new_top      = {};
    new_top.peers = new Set( scheduler.active_actxs );
    scheduler.active_actxs = new Set( [ actx ] );
    scheduler.atomic_stack.push( new_top );

    try {
        var params = params_plus_fn.slice( 0, params_plus_fn.length - 1 );
        const fn     = atomicable( this, params_plus_fn[ params_plus_fn.length - 1 ] );
        var rv = await fn( ...params );
        var is_err = false;
    }
    catch( err ) {
        var rv = err;
        var is_err = true;
    }
    /* pop atomic stack -- complicated shit */

    // console.log( "leaveAtomic", first_entry );
    const top = scheduler.atomic_stack;
    assert( top.hasOwnProperty( this.id ) );
    scheduler.atomic_stack = top.next;

    /* TODO: There's a potential scalability bug here, if the
     * number of waiting activities is large and many of them
     * are forced to go back to waiting before making any
     * progress.
     *
     * However, the simplest alternatives seem to have important
     * fairness problems with atomic mode.  That is, how can we
     * guarantee that an activity is not stuck indefinitely
     * while other activities go in and out of atomic mode?
     *
     * For now I'm going to leave it, because I think it would
     * take a really weird program to trigger the scalability
     * bug. */

    top.waiting.sort( function( a, b ) {
        const diff = b.waits - a.waits;
        if( diff == 0 )
            return a.queue_len - b.queue_len;
        else
            return diff;
    } );
    for( const actx of top.waiting.values() )
    {
        const cont = actx.continuation;
        actx.continuation = null;
        cont();
    }

    if( is_err )
    {
        throw rv;
    }
    return rv;
}
}

const atomic = atomicOpts( {} );

function selfActivity()
{
    assert( isContext( current_context ) );
    return current_context;
}

function log( ...params )
{
    const actx = current_context;
    assert( isContext( actx ) );
    const call_stack = actx[ CALL_STACK_TAG ];
    assert( call_stack.length > 0 );
    const [ gen_fn, gen ] = call_stack[ call_stack - 1 ];
    // XXX bracket??? console.log( this.id, names.bracket, ...params );
    console.log( actx[ ID_TAG ], gen_fn.name, ...params );
}

function isContext( thing )
{
    if( thing == null )
        return false;
    return ID_TAG in thing;
}

// atomicify.Scheduler = Scheduler;
atomicify.isContext = isContext;
atomicify.activate  = activate;
atomicify.log = log;

export default atomicify;
