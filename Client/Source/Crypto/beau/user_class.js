const WebCrypto = require("node-webcrypto-ossl");
const WC = new WebCrypto();
const CS = WC.subtle;

async function main() {
    bob = await user();
    alice = await user();

    triple_diffie_hellman(alice, bob);
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

main();

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
    let data_to_sign = Buffer.from(prekey_string, "utf-8");

    let signature = await CS.sign(
        { name: "ECDSA", hash: {name: "SHA-256"} },
        dsa_private_key, data_to_sign
    );

    return signature;
}

async function triple_diffie_hellman(sender, reciever) {
    shared_secret = Buffer.from("lenny is the unchallenged king", 'utf8');

    // console.log(reciever.signed_prekey.keypair.publicKey);

    prekey_signature_verification = await verify_key_signature(
        reciever.identity_dsa_keypair.publicKey,
        reciever.signed_prekey.keypair.publicKey,
        reciever.signed_prekey.signature
    );

    // TODO: derive shared secret from sender.identity to reciever.prekey
    // TODO: derive shared secret from sender.ephemeral to reciever.prekey
    // TODO: derive shared secret from sender.ephemeral to reciever.identity
    // TODO: derive shared secret from sender.ephemeral to reciever.onetime

    console.log(prekey_signature_verification);


    return shared_secret
}

async function verify_key_signature(dsa_public_key, signed_dh_key, signature) {
    let dh_public_key_string = JSON.stringify(await CS.exportKey("jwk", signed_dh_key));
    let dh_public_key_buffer = Buffer.from(dh_public_key_string, 'utf8');

    let verify = await CS.verify(
        { name: "ECDSA", hash: {name: "SHA-256"} },
        dsa_public_key, signature, dh_public_key_buffer
    );

    return verify;
}

async function derive_shared_secret(public_key, private_key) {
    shared_secret = Buffer.from("lenny is the unchallenged king", 'utf8');


    return secret
}
