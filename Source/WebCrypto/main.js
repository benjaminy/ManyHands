/*
 *
 */

var log = console.log.bind( console );
var getElemId = document.getElementById.bind( document );
var C = window.crypto.subtle;

function onLoad()
{
    log( 'onLoad ');
    p = parseInt( sessionStorage.getItem( 'filePort' ) );
    if( isNaN( p ) )
    {
        alert( 'Problem with port '+sessionStorage.getItem( 'filePort' )
               +'. Back to login ...'  );
        window.location.href = 'index.html';
    }
    getElemId( 'IdStatusPort' ).innerHTML = p;
    var keys = null;
    fetch( 'http://localhost:'+p+'/priv_key'
        ).then( function( resp ) {
            log( 'Y ',resp );
            if( resp.ok )
            {
                alert( 'OK' );
            }
            else
            {
                alert( 'NOT OK' );
                return C.generateKey( { name: 'ECDH', namedCurve: 'P-521' },
                                      true,
                                      [ 'deriveKey', 'deriveBits' ] );
            }
        } ).then( function( k ) {
            keys = k;
            log( "K",keys );
            return C.exportKey( 'jwk', keys.privateKey );
        } ).then( function( privKeyData ) {
            log( 'Priv:', privKeyData );
            log( JSON.stringify( privKeyData ) );
            log( JSON.parse( JSON.stringify( privKeyData ) ) );
            return C.exportKey( 'jwk', keys.publicKey );
        } ).then( function( publKeyData ) {
            log( 'Publ:', publKeyData );
        } ).catch( function( err ) {
            log( 'Private key fail',err );
            alert( 'Mysterious failure while loading private key. See log.' );
        } );
}

function onDoStuff()
{
    var content = 'HeAd';
    var myHeaders = new Headers( {
        'Content-Type':   'text/plain',
        'Content-Length': '' + content.length
    } );
    fetch( 'http://localhost:'+p+'/joe/foo.txt',
           { method  : 'POST',
             body    : content,
             headers : myHeaders }
        ).then( function( resp ) {
            log( 'Love? ', resp );
        } );
}
