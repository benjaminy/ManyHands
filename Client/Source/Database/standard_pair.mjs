/*
 * Top Matter
 */

/*
 * File Comment
 */

    function generateSignKey() {
        return WCS.generateKey(
            { name: "HMAC", hash:"SHA-256" }, true, [ "sign", "verify" ] );
    }
    function sign( data, file_ptr ) {
        return WCS.sign( { name: "HMAC" }, file_ptr.keyS, data );
    }
    function verify( signature, data, file_ptr ) {
        return WCS.verify( { name: "HMAC" }, file_ptr.keyS, signature, data );
    }

    const rand_name_signed_storage =
        SW.filePtrGenWrapper(
            { param_name: "keyS",
              keyS_generator: generateSignKey },
            SW.authenticationWrapper(
                { tag_bytes: 32,
                  sign: sign,
                  verify: verify },
                SW.randomNameWrapper( storage ) ) );

    if( kind === DC.KIND_PRIVATE || kind === DC.KIND_TEAM )
    {
        function generateCryptKey() {
            return WCS.generateKey(
                { name: "AES-CBC", length:256 }, true, [ "encrypt", "decrypt" ] );
        }
        function generateIV() {
            return Promise.resolve( new Uint8Array( 16 ) );
        }
        function encrypt( data, file_ptr ) {
            return WCS.encrypt( { name: "AES-CBC", iv:file_ptr.iv }, file_ptr.keyC, data );
        }
        function decrypt( data, file_ptr ) {
            return WCS.decrypt( { name: "AES-CBC", iv:file_ptr.iv }, file_ptr.keyC, data );
        }
        var bloop_storage =
            SW.filePtrGenWrapper(
                { param_name: "keyC",
                  keyC_generator: generateCryptKey },
                SW.filePtrGenWrapper(
                    { param_name: "iv",
                      iv_generator: generateIV },
                    SW.confidentialityWrapper(
                        { encrypt: encrypt,
                          decrypt: decrypt },
                        rand_name_signed_storage ) ) );
    }
    else
    {
        var bloop_storage = rand_name_signed_storage;
    }
    db.storage = SW.encodingWrapper( SW.SK_JSON, {}, bloop_storage );
