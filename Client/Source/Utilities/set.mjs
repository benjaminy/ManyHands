/* Top Matter */

/* Copied from Xah Lee */

export function union( ...sets )
{
    const x = new Set();
    sets.forEach(
        ( s ) => (
            s.forEach( ( e ) => ( x.add( e ) ) )
        )
    );
    return x;
}

export function intersection( ...sets )
{
    sets.reduce(
        ( A, B ) => {
            let X = new Set();
            B.forEach( ( v => { if ( A.has(v) ) X.add(v) } ) );
            return X;
        } );
}

export function difference( ...sets )
{
    sets.reduce(
        ( A, B ) => {
            let X = new Set(A);
            B.forEach( v => { if ( X.has(v) ) X.delete( v ) } );
            return X;
        }
    );
}
