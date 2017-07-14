/*
 * This little library is designed to address problems that arrise in
 * logging and debugging in Promise-heavy code.  It is easy to lose the
 * context in which some code is (logically) executing.
 */


export interface scp
{
    prefix: string;
    prefix_no_bracket: string;
    old_stacks: any;
}

export class Scope
{
    static log( scp )
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

    static enter( scp, name ) : [ scp, any ]
    {
        var prefix_no_bracket;
        if( scp )
        {
            prefix_no_bracket = scp.prefix_no_bracket + ':' + name;
        }
        else
        {
            prefix_no_bracket = name;
        }
        var new_scp =
        {
            prefix            : '[' + prefix_no_bracket + ']',
            prefix_no_bracket : prefix_no_bracket,
            old_stacks        : scp.old_stacks,
        };
        // Error.captureStackTrace( blah, Scope.enter );
        return [ new_scp, Scope.log( new_scp ) ];
    }

    static anon( scp )
    {
        var new_scp =
        {
            prefix            : scp.prefix,
            prefix_no_bracket : scp.prefix_no_bracket,
            old_stacks        : scp.old_stacks.slice(),
        }
        new_scp.old_stacks.push( scp.stack );
    }
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

