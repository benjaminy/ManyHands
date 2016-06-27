/*
 * This little library is designed to address problems that arrise in
 * logging and debugging in Promise-heavy code.  It is easy to lose the
 * context in which some code is (logically) executing.
 */

function Scope( prefix, prefix_no_bracket, old_stacks, stack )
{
    this.prefix            = prefix;
    this.prefix_no_bracket = prefix_no_bracket;
    this.old_stacks        = old_stacks;
    this.stack             = stack;
}

Scope.log = function( scp )
{
    return function( ...params )
    {
        if( scp )
        {
            console.log( scp.prefix, ...params );
        }
        else
        {
            console.log( ...params );
        }
    }
}

Scope.enter = function( scp, name )
{
    var prefix_no_bracket = name;
    var old_stacks = [];
    if( scp )
    {
        prefix_no_bracket = scp.prefix_no_bracket + ':' + name;
        old_stacks        = scp.old_stacks;
    }
    var new_scp = new Scope(
        '[' + prefix_no_bracket + ']',
        prefix_no_bracket,
        old_stacks,
        '' );
    polyfill_captureStackTrace( new_scp, Scope.enter );
    return [ new_scp, Scope.log( new_scp ) ];
}

Scope.anon = function( scp )
{
    var prefix_no_bracket = '';
    var prefix = '[]';
    var old_stacks = [];
    if( scp )
    {
        prefix_no_bracket = scp.prefix_no_bracket;
        prefix            = scp.prefix;
        old_stacks        = scp.old_stacks.slice();
    }
    var new_scp = new Scope(
        prefix,
        prefix_no_bracket,
        old_stacks,
        '' );
    new_scp.old_stacks.push( scp.stack );
    polyfill_captureStackTrace( new_scp, Scope.enter );
    return new_scp;
}

// Scope.anon = function( scp

// Scope.cont = function( p1, p2, ...params )
// {
// }

// function LogEnv( scopes, name )
// {
//     this.scopes = [];
//     if( scopes )
//         this.scopes = scopes;
//     if( name )
//         this.scopes.push( name );
// }

// LogEnv.prototype.push =
// function( name )
// {
//     return new LogEnv( this.scopes.slice(), name );
// }

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

