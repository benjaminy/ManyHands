const WebCrypto = require("node-webcrypto-ossl");
const WC = new WebCrypto();
const CS = WC.subtle;

async function main() {
    bob = await user();
    alice = await user();

    alice_shared_secret = await triple_diffie_hellman(alice, bob);
    console.log(alice_shared_secret)
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
    prekey_signature_verification = await verify_key_signature(
        reciever.identity_dsa_keypair.publicKey,
        reciever.signed_prekey.keypair.publicKey,
        reciever.signed_prekey.signature
    );

    derived_dh_key_1 = await derive_shared_secret(
            sender.identity_dh_keypair.privateKey,
            reciever.signed_prekey.keypair.publicKey
    );
    derived_dh_key_1 = new Uint32Array(derived_dh_key_1);

    derived_dh_key_2 = await derive_shared_secret(
            sender.ephemeral_keypair.privateKey,
            reciever.signed_prekey.keypair.publicKey
    );
    derived_dh_key_2 = new Uint32Array(derived_dh_key_2);

    derived_dh_key_3 = await derive_shared_secret(
        sender.ephemeral_keypair.privateKey,
        reciever.identity_dh_keypair.publicKey
    );
    derived_dh_key_3 = new Uint32Array(derived_dh_key_3);

    derived_dh_key_4 = await derive_shared_secret(
        sender.ephemeral_keypair.privateKey,
        reciever.one_time_prekey.publicKey
    );
    derived_dh_key_4 = new Uint32Array(derived_dh_key_4);

    let shared_secret = new Uint32Array(
        derived_dh_key_1.length + derived_dh_key_2.length +
        derived_dh_key_3.length + derived_dh_key_4.length
    );

    // TODO: sphaghetti code
    shared_secret.set(derived_dh_key_1);
    shared_secret.set(derived_dh_key_2, derived_dh_key_1.length);
    shared_secret.set(derived_dh_key_3, (derived_dh_key_1.length + derived_dh_key_2.length));
    shared_secret.set(derived_dh_key_4, (derived_dh_key_1.length + derived_dh_key_2.length + derived_dh_key_3.length));

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

async function derive_shared_secret(private_key, public_key) {
    let derived_secret = await CS.deriveBits(
        {
            name: "ECDH",
            namedCurve: "P-256",
            public: public_key,
        },
        private_key,
        256
    );

    return derived_secret;
}
