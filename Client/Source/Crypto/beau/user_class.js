const WebCrypto = require("node-webcrypto-ossl");
const WC = new WebCrypto();
const CS = WC.subtle;

async function generate_dh_keypair() {
    let keypair = await CS.generateKey(
        { name: "ECDH", namedCurve: "P-256"},
        true, ["deriveKey", "deriveBits"]
    );

    return keypair;
}

async function generate_dsa_keypair(dh_keypair) {
    let exported_dh_private_key = await CS.exportKey( "jwk", dh_keypair.privateKey );
    let exported_dh_public_key = await CS.exportKey( "jwk", dh_keypair.publicKey );

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
        exported_dh_public_key,
        { name: "ECDSA", namedCurve: "P-256" },
        true, ["verify"]
    );

    return { publicKey: dsa_public_key, privateKey: dsa_private_key}
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


async function user(name) {
    const u = {};
    u.name = name;

    u.identity_dh_keypair = await generate_dh_keypair();
    u.identity_dsa_keypair = await generate_dsa_keypair(u.identity_dh_keypair);

    prekey = await generate_dh_keypair();
    signature = await sign_key(prekey.publicKey, u.identity_dsa_keypair.privateKey)
    u.signed_prekey = {
        keypair: prekey,
        signature: signature
    };

    u.one_time_prekey = await generate_dh_keypair();
    u.ephemeral_keypair = await generate_dh_keypair();

    return u;
}

async function main() {
    bob = await user();
    console.log("***********identity keys***********");
    console.log(bob.identity_dh_keypair);
    console.log("***********dsa keys***********");
    console.log(bob.identity_dsa_keypair);
    console.log("***********signed keys***********");
    console.log(bob.signed_prekey);
    console.log("***********one time keys***********");
    console.log(bob.one_time_prekey);
    console.log("***********ephemeral keys***********");
    console.log(bob.ephemeral_keypair);
}

main();
