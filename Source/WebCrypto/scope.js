/*
 * This little library is designed to address problems that arrise in
 * logging and debugging in Promise-heavy code.  It is easy to lose the
 * context in which some code is (logically) executing.
 */

Scope.max_task_id = 0;

function Scope( prefix, prefix_no_bracket, old_stacks, stack, tid )
{
    this.prefix            = prefix;
    this.prefix_no_bracket = prefix_no_bracket;
    this.old_stacks        = old_stacks;
    this.stack             = stack;
    this.tid               = tid;
}

Scope.copy = function( scp )
{
    if( scp )
        return new Scope( scp.prefix,
                          scp.prefix_no_bracket,
                          scp.old_stacks,
                          scp.stack,
                          scp.tid );
    else
        return new Scope( '[]', '', [], '', null );
}

Scope.log = function( scp )
{
    return function( ...params )
    {
        if( scp.task_id )
            console.log( scp.task_id, scp.prefix, ...params );
        else
            console.log( scp.prefix, ...params );
    }
}

Scope.enter = function( scp, name )
{
    var new_scp = Scope.copy( scp );
    if( new_scp.prefix_no_bracket.length > 0 )
        new_scp.prefix_no_bracket = new_scp.prefix_no_bracket + ':' + name;
    else
        new_scp.prefix_no_bracket = name;
    new_scp.prefix = '[' + new_scp.prefix_no_bracket + ']';
    polyfill_captureStackTrace( new_scp, Scope.enter );
    return [ new_scp, Scope.log( new_scp ) ];
}

Scope.anon = function( scp )
{
    var new_scp = Scope.copy( scp );
    new_scp.old_stacks = new_scp.old_stacks.slice();
    new_scp.old_stacks.push( new_scp.stack );
    polyfill_captureStackTrace( new_scp, Scope.enter );
    return new_scp;
}

Scope.startTask = function( scp )
{
    var new_scp = Scope.copy( scp );
    Scope.max_task_id++;
    new_scp.task_id = Scope.max_task_id
    return [ new_scp, Scope.log( new_scp ) ];
}

Scope.tasksEqual = function( scp1, scp2 )
{
    if( !scp1 || !( task_id in scp1 ) || !scp1.task_id )
        return false;
    if( !scp2 || !( task_id in scp2 ) || !scp1.task_id )
        return false;
    return scp1.task_id == scp2.task_id;
}

// LogEnv.prototype.pop =
// function( name )
// {
//     var l = new LogEnv( this.scopes.slice() );
//     l.scopes.pop();
//     return l;
// }

// function log( p1, p2, ...params )
// {
//     if( typeof( p1 ) == 'string' )
//     {
//         if( !p2 )
//         {
//             p2 = new LogEnv();
//         }
//         p2.scopes.push( p1 );
//         var prefix = '['+p2.scopes.join(':')+']';
//         console.log( prefix, ...params );
//         p2.scopes.pop();
//     }
//     else
//     {
//         if( p1 )
//         {
//             var prefix = '['+p1.scopes.join(':')+']';
//             console.log( prefix, p2, ...params );
//         }
//         else
//             console.log( p2, ...params );
//     }
// }

