/* Top Matter */

/* This is a pretty cheesy assert, but whatever (for now) */

export default function assert( must_be_true, message )
{
    if( must_be_true === true )
        return;
    throw new Error( message );
}
