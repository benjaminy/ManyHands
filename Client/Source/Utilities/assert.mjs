/* Top Matter */

function assert( must_be_true, message )
{
    if( must_be_true === true )
        return;
    throw new Error( message );
}

export { assert };
