const WebCrypto = require("node-webcrypto-ossl");
const WC = new WebCrypto();
const CS = WC.subtle;

// TODO: Seems silly to export then import back in....
async function create_identity_key() {

    dh_key = await CS.generateKey(
        { name: "ECDH", namedCurve: "P-256"},
        true, ["deriveKey", "deriveBits"]
    );

    exported_dh_private_key = await CS.exportKey( "jwk", dh_key.privateKey );
    exported_dh_public_key = await CS.exportKey( "jwk", dh_key.publicKey );

    dsa_private_key = await CS.importKey(
        "jwk",
        {
            kty: exported_dh_private_key.kty,
            crv: exported_dh_private_key.crv,
            x: exported_dh_private_key.x,
            y: exported_dh_private_key.y,
        },
        { name: "ECDSA", namedCurve: "P-256" },
        true, ["verify"]
    );

    dsa_public_key = await CS.importKey(
        "jwk",
        {
            kty: exported_dh_public_key.kty,
            crv: exported_dh_public_key.crv,
            x: exported_dh_public_key.x,
            y: exported_dh_public_key.y,
        },
        { name: "ECDSA", namedCurve: "P-256" },
        true, ["verify"]
    );

    return {
        dh_public_key: dh_key.publicKey,
        dh_private_key: dh_key.privateKey,
        dsa_public_key: dsa_public_key,
        dsa_private_key: dsa_private_key,
    }
}

async function main() {
    indentity_key_bundle = await create_identity_key();
    console.log("************* DH PUBLIC");
    console.log(indentity_key_bundle.dh_public_key);
    console.log("************* DH PRIVATE");
    console.log(indentity_key_bundle.dh_private_key);
    console.log("************* DSA PUBLIC");
    console.log(indentity_key_bundle.dsa_public_key);
    console.log("************* DSA PRIVATE");
    console.log(indentity_key_bundle.dsa_private_key);
}

main();
