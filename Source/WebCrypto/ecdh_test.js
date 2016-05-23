var P = Promise
var C = window.crypto.subtle;
var log = console.log.bind( console );
var getRandomValues = window.crypto.getRandomValues.bind( window.crypto );
var resolve = P.resolve.bind( P );

var a = { name: 'ECDH', namedCurve: 'P-521' };
var b = { name: 'AES-CBC', length: 256  };
var c = [ 'deriveKey', 'deriveBits' ];
var d = [ 'encrypt', 'decrypt' ];
var e = { name: 'AES-CBC', iv: new Uint8Array( 16 ) };

function exportHelper( k )
{
    return C.exportKey( 'jwk', k );
}

function getRandomBytes( num_bytes )
{
    var x = new Uint8Array( num_bytes );
    getRandomValues( x );
    return x;
}

function test()
{
    P.all( [ C.generateKey( a, true, c ), C.generateKey( a, true, c ) ] )
    .then( function( [ k1, k2 ] ) {
        var p1 = C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: k1.publicKey },
            k2.privateKey, b, true, d );
        var p2 = C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: k2.publicKey },
            k1.privateKey, b, true, d );
        var ks = [ k1.publicKey, k1.privateKey, k2.publicKey, k2.privateKey ];
        return P.all( ks.map( exportHelper ).concat( [ p1, p2 ] ) );
    } ).then( function( [ u1, r1, u2, r2, k1, k2 ] ) {
        log( 'Step 2', u1, r1, u2, r2 );
        var x = getRandomBytes( 8 );
        var p1 = C.encrypt( e, k1, x );
        var p2 = C.encrypt( e, k2, x );
        return P.all( [ k1, k2 ].map( exportHelper ).concat( [ p1, p2 ] )
                      .concat( [ k1, k2 ].map( resolve ) ) );
    } ).then( function( [ k1, k2, e1, e2, r1, r2 ] ) {
        log( 'Step 3', k1.k == k2.k, k1, k2 );
        var p1 = C.decrypt( e, r1, e2 );
        var p2 = C.decrypt( e, r2, e1 );
        return P.all( [ p1, p2 ] );
    } ).then( function( [ x1, x2 ] ) {
        log( 'Step 3', new Uint8Array( x1 ), new Uint8Array( x2 ) );
        // assert( x1 == x2 )
    } ).catch( function( err ) {
        log( 'Error', err );
    } )
}
