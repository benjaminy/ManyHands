/* Top Matter */

"use strict";

import assert from "./assert.mjs";
const P = Promise;

let ACT_FN_TAG           = Symbol( "activity" );
let ATOMICABLE_TAG       = Symbol( "atomicable" );
let ACT_STATE_TAG        = Symbol( "activity_state" );
let EXPECTS_CTX_TAG      = Symbol( "expects_ctx" );
let RTRN_FROM_ATOMIC_TAG = Symbol( "rtrn_from_atomic" );
let DO_NOT_PASS_TAG      = Symbol( "do_not_pass" );
let ACTX_FROM_SETUP      = Symbol( "actx_from_setup" );
let RUNNABLE             = Object.freeze( { t: ACT_STATE_TAG } );
let RUNNING              = Object.freeze( { t: ACT_STATE_TAG } );
let WAITING              = Object.freeze( { t: ACT_STATE_TAG } );
let RESOLVING            = Object.freeze( { t: ACT_STATE_TAG } );
let GENERATOR_ERROR      = Object.freeze( { t: ACT_STATE_TAG } );
let FINISHED             = Object.freeze( { t: ACT_STATE_TAG } );

const activity_names = {};

/* Function for defining "activity functions" (basically a special flavor of async function)
 * atomicable can be called in two ways:
 *  - with just an async function
 *  - an activity context, then an async function
 * The former creates a function that can be invoked in different contexts and passes
 * an activity context reference to the generator function.
 * The latter creates a function that can only be invoked in the given context, and
 * does _not_ pass that context on to the generator function.
 * The latter is primarily for internal use (with "atomic"), but can be used by client
 * code.
 */

function atomicable( ...atomicable_params )
{
    const np = atomicable_params.length;
    assert( np > 0, "atomicable: no parameters" );
    assert( np < 3, "atomicable: too many parameters: " + np );

    const [ async_function, actx_setup ] = np === 1
          ? [ atomicable_params[ 0 ], undefined ]
          : [ atomicable_params[ 1 ], atomicable_params[ 0 ] ];

    assert( actx_setup === undefined || isContext( actx_setup ) );

    // console.log( "atomicable", async_function.name, actx_setup );

    if( ATOMICABLE_TAG in async_function )
        return async_function;

    const callFn = async function callFn( ...params )
    {
        const actx_call = actx_setup ? actx_setup : params[ 0 ];
        assert( isContext( actx_call ) );

        async function notBlocked()
        {
            const blocks = [];
            while( actx_call.blockedByAtomic() )
            {
                actx_call.addToWaiting();
                blocks.push( await new Promise( function( resolve, reject ) {
                    actx_call.continue = resolve;
                    actx_call.abort    = reject;
                } ) );
            }
            return blocks;
        }

        await notBlocked();
        // console.log( "CALLING", async_function.name );
        actx_call.async_fns.push( async_function );

        function leaveScope()
        {
            const a = actx_call.async_fns.pop();
            assert( a === async_function, "Wrong pop: " + a.name
                    + " " + async_function.name );
        }

        try {
            var rv = await async_function( ...params );
        }
        catch( err ) {
            await notBlocked();
            // console.log( "THROWING", async_function.name, String( err ) );
            leaveScope();
            throw err;
        }
        await notBlocked();
        // console.log( "RETURNING", async_function.name, String( rv ) );
        leaveScope();
        return rv;
    }
    callFn[ EXPECTS_CTX_TAG ] = !actx_setup;
    callFn[ ATOMICABLE_TAG ] = undefined;
    return callFn;
}

class Scheduler
{
    constructor( options )
    {
        this.activities           = {};
        this.num_activities       = 0;
        this.atomic_stack         = {};
        this.atomic_stack.waiting = new Set();
        this.atomic_stack.next    = null;
    }

    activateInternal( parent, ...params_plus_f )
    {
        /* XXX atomic vs not? */
        // console.log( "activateInternal" );
        let params = params_plus_f.slice( 0, params_plus_f.length - 1 );
        let fn     = atomicable( params_plus_f[ params_plus_f.length - 1 ] );
        let child  = new Context( this, parent );

        child.state = RUNNABLE;
        child.finished_promise =
            fn( child, ...params ).then(
                ( rv ) => {
                    child.state = FINISHED;
                    assert( child.id in this.activities );
                    const id = child.id;
                    delete this.activities[ child.id ];
                    this.num_activities--;
                    assert( Object.keys( this.activities ).length ==
                            this.num_activities )
                    console.log( "Activity Finished", id, this.num_activities );
                    return P.resolve( rv );
                } );
        return child;
    }

    activate( ...params_plus_f )
    {
        console.log( "SCHEDULER.ACTIVATE", this );
        return this.activateInternal( null, ...params_plus_f );
    }
}

class Context
{
    constructor( scheduler, parent ) {
        this.continue   = null;
        this.abort      = null;
        this.waits      = 0;
        this.async_fns = [];
        this.scheduler  = scheduler;
        this.id         = Symbol( "activity_id" );
        this.parent     = parent;
        console.log( "CONTEXT CONSTRUCTOR", scheduler );
        scheduler.activities[ this.id ] = this;
        scheduler.num_activities++;
    }

    addtoWaiting()
    {
        /* assert( actx not in scheduler.waiting_activities ); */
        this.state = WAITING;
        this.waits++;
        this.queue_len = this.scheduler.atomic_stack.waiting.size;
        this.scheduler.waiting.add( this );
    }

    blockedByAtomic()
    {
        if( !this.scheduler.atomic_stack.next )
            return false;
        return !this.scheduler.atomic_stack.hasOwnProperty( this.id );
    }

    activate( ...params_plus_f )
    {
        console.log( "N 1", this.scheduler );
        return this.scheduler.activateInternal( this, ...params_plus_f );
    }

    /* Curried version. (Maybe useful in some HOF situations.) */
    activate_c( f )
    {
        return function( ...params ) {
            params.push( f );
            return this.activate( ...params );
        }
    }

    atomicify( p )
    {
        return new Promise( function( resolve, reject ) {
            this.waitForAtomic().then(
                function() { return p; } ).then(
                    function() { return this.waitForAtomic() } );
        } );
    }

    atomic( ...params_plus_fn )
    {
        var params    = params_plus_fn.slice( 0, params_plus_fn.length - 1 );
        let fn        = atomicable( this, params_plus_fn[ params_plus_fn.length - 1 ] );
        let scheduler = this.scheduler;

        const leaveAtomic = () =>
        {
            // console.log( "leaveAtomic", first_entry );
            let top = scheduler.atomic_stack;
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
                let diff = b.waits - a.waits;
                if( diff == 0 )
                    return a.queue_len - b.queue_len;
                else
                    return diff;
            } );
            for( let actx of top.waiting.values() )
            {
                let cont = actx.continuation;
                actx.continuation = null;
                cont();
            }
        }

        scheduler.atomic_actx = this;
        try {
            if( fn[ EXPECTS_CTX_TAG ] )
                params.unshift( this );
            let p = fn( ...params );
        }
        catch( err ) {
            leaveAtomic();
            return P.reject( err );
        }

        return p.then(
            function( val ) {
                leaveAtomic();
                var rv = { "value" : val,
                           RTRN_FROM_ATOMIC_TAG : true };
                return P.resolve( val );
            },
            function( err ) {
                leaveAtomic();
                return P.reject( err );
            } );
    }

    log( ...params )
    {
        assert( this.async_fns.length > 0 );
        var gen_fn = this.async_fns[ this.async_fns.length - 1 ];
        // XXX bracket??? console.log( this.id, names.bracket, ...params );
        console.log( this.id, gen_fn.name, ...params );
    }
}

function isContext( thing )
{
    return thing && thing.constructor === Context;
}

atomicable.Scheduler = Scheduler;
atomicable.isContext = isContext;

const awaitPromise = atomicable( async function( p ) { return await p; } );

export default atomicable;
