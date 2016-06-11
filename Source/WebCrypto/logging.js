/*
 *
 */

function LogEnv( scopes, name )
{
    this.scopes = [];
    if( scopes )
        this.scopes = scopes;
    if( name )
        this.scopes.push( name );
}

LogEnv.prototype.push =
function( name )
{
    return new LogEnv( this.scopes.slice(), name );
}

LogEnv.prototype.pop =
function( name )
{
    var l = new LogEnv( this.scopes.slice() );
    l.scopes.pop();
    return l;
}

function log( p1, p2, ...params )
{
    if( typeof( p1 ) == 'string' )
    {
        if( !p2 )
        {
            p2 = new LogEnv();
        }
        p2.scopes.push( p1 );
        var prefix = '['+p2.scopes.join(':')+']';
        console.log( prefix, ...params );
        p2.scopes.pop();
    }
    else
    {
        if( p1 )
        {
            var prefix = '['+p1.scopes.join(':')+']';
            console.log( prefix, p2, ...params );
        }
        else
            console.log( p2, ...params );
    }
}

