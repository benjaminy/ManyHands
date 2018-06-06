const WebCrypto = require("node-webcrypto-ossl");
const WC = new WebCrypto();
const CS = WC.subtle;

async function generate_dh_keypair() {
    let keypair = await CS.generateKey(
        { name: "ECDH", namedCurve: "P-256"},
        true, ["deriveKey", "deriveBits"]
    );

    return { public_key: keypair.publicKey, private_key: keypair.privateKey}
}

async function generate_dsa_keypair(dh_keypair) {
    let exported_dh_private_key = await CS.exportKey( "jwk", dh_keypair.private_key );
    let exported_dh_public_key = await CS.exportKey( "jwk", dh_keypair.public_key );

    delete exported_dh_private_key.key_ops;
    delete exported_dh_public_key.key_ops;

    let dsa_private_key = await CS.importKey(
        "jwk",
        exported_dh_private_key,
        { name: "ECDSA", namedCurve: "P-256" },
        true, ["sign"]
    );

    let dsa_public_key = await CS.importKey(
        "jwk",
        exported_dh_private_key,
        { name: "ECDSA", namedCurve: "P-256" },
        true, ["verify"]
    );

    return { public_key: dsa_public_key, private_key: dsa_private_key}
}

async function sign_key(key_to_sign, dsa_private_key) {
    let prekey_string = JSON.stringify( await CS.exportKey("jwk", key_to_sign));
    let data_to_sign = new Buffer.from(prekey_string, "utf-8");

    let signature = await CS.sign(
        { name: "ECDSA", hash: {name: "SHA-256"} },
        dsa_private_key, data_to_sign
    );

    return signature;
}

async function verify_key_signature(signature, signed_key, dsa_public_key) {
    let prekey_string = JSON.stringify(await CS.exportKey("jwk", signed_key));

    console.log(signature);
    console.log(typeof signature);

    let verify = await CS.verify(
        { name: "ECDSA", hash: {name: "SHA-256"} },
        dsa_public_key, signature, prekey_string
    );

    return verify;
}

async function main() {
    let keypair = await generate_dh_keypair();
    let dsa_keypair = await generate_dsa_keypair(keypair);
    let pre_key = await generate_dh_keypair();
    let signature = await sign_key(pre_key.public_key, dsa_keypair.private_key);
    let isvalid = await verify_key_signature(signature, pre_key.public_key, dsa_keypair.public_key);
}

main();
