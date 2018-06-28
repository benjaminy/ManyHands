import * as my_crypto from "../clean/crypto_wrappers";

import WebCrypto from "node-webcrypto-ossl";
const WC = new WebCrypto();
const CS = WC.subtle;

import assert from "assert";
import TextEncoder from "text-encoding";
const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

export async function generate_dsa_keypair(dh_keypair) {
    assert(dh_keypair.publicKey.algorithm.name === "ECDH");
    assert(dh_keypair.publicKey.type === "public");
    assert(dh_keypair.privateKey.algorithm.name === "ECDH");
    assert(dh_keypair.privateKey.type === "private");

    let exported_dh_private_key = await CS.exportKey( "jwk", dh_keypair.privateKey );
    let exported_dh_public_key = await CS.exportKey( "jwk", dh_keypair.publicKey);

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

export async function sign_key(key_to_sign, dsa_private_key) {
    assert(key_to_sign.algorithm.name === "ECDH");
    assert(key_to_sign.type === "public");
    assert(dsa_private_key.algorithm.name === "ECDSA");
    assert(dsa_private_key.type === "private");

    let exported_prekey = await CS.exportKey("jwk", key_to_sign);
    let data_to_sign = my_crypto.encode_object(exported_prekey);

    let signature = await CS.sign(
        { name: "ECDSA", hash: {name: "SHA-256"} },
        dsa_private_key, data_to_sign
    );

    return signature;
}

export async function verify_key_signature(signature, signed_key, dsa_public_key) {
    assert(new DataView(signature).byteLength > 0);
    assert(signed_key.algorithm.name === "ECDH");
    assert(signed_key.type === "public");

    assert(dsa_public_key.algorithm.name === "ECDSA");
    assert(dsa_public_key.type === "public");

    let exported_prekey = await CS.exportKey("jwk", signed_key);
    let data_to_sign = my_crypto.encode_object(exported_prekey);


    let verify = await CS.verify(
        { name: "ECDSA", hash: {name: "SHA-256"} },
        dsa_public_key, signature, data_to_sign
    );

    return verify;
}

export async function sender_triple_diffie_hellman(sender_init_keys, reciever_init_keys) {
    assert(sender_init_keys.identity_dh !== undefined);
    assert(reciever_init_keys.identity_dh !== undefined);
    assert(sender_init_keys.identity_dsa !== undefined);
    assert(reciever_init_keys.identity_dsa !== undefined);

    let dh1 = {};

    let prekey_verification = await verify_key_signature(
        reciever_init_keys.signed_prekeys[0].signature,
        reciever_init_keys.signed_prekeys[0].prekey.publicKey,
        reciever_init_keys.identity_dsa.publicKey
    );

    assert(prekey_verification);

    dh1.publicKey = reciever_init_keys.signed_prekeys[0].prekey.publicKey;
    dh1.privateKey = sender_init_keys.identity_dh.privateKey;

    let dh2 = {};

    dh2.public_key = reciever_init_keys.identity_dh.publicKey
    // TODO need to add the functionality of a ephemeral key?

    let ephemeral_key = await my_crypto.generate_dh_key();

    dh2.publicKey = reciever_init_keys.identity_dh.publicKey;
    dh2.privateKey = ephemeral_key.privateKey;

    let dh3 = {}

    dh3.publicKey = reciever_init_keys.signed_prekeys[0].prekey.publicKey;
    dh3.privateKey = ephemeral_key.privateKey;

    let dh4 = {}

    dh4.publicKey = reciever_init_keys.one_time_prekeys[0].publicKey;
    dh4.privateKey = ephemeral_key.privateKey;

    let shared_secret = await core_triple_diffie_hellman(dh1, dh2, dh3, dh4);

    return {shared_secret: shared_secret, ephemeral_public_key: ephemeral_key.publicKey};

}

export async function reciever_triple_diffie_hellman(sender_init_keys, ephemeral_public_key, reciever_init_keys) {
    let dh1 = {};
    dh1.publicKey = sender_init_keys.identity_dh.publicKey;
    dh1.privateKey = reciever_init_keys.signed_prekeys[0].prekey.privateKey;

    let dh2 = {};
    dh2.publicKey = ephemeral_public_key;
    dh2.privateKey = reciever_init_keys.identity_dh.privateKey;

    let dh3 = {};
    dh3.publicKey = ephemeral_public_key;
    dh3.privateKey = reciever_init_keys.signed_prekeys[0].prekey.privateKey;

    let dh4 = {};
    dh4.publicKey = ephemeral_public_key;
    dh4.privateKey = reciever_init_keys.one_time_prekeys[0].privateKey;

    let shared_secret = await core_triple_diffie_hellman(dh1, dh2, dh3, dh4);
    return shared_secret;
}

export async function core_triple_diffie_hellman(dh1, dh2, dh3, dh4) {

    let dh1_secret = await my_crypto.derive_dh(dh1.publicKey, dh1.privateKey);
    let dh2_secret = await my_crypto.derive_dh(dh2.publicKey, dh2.privateKey);
    let dh3_secret = await my_crypto.derive_dh(dh3.publicKey, dh3.privateKey);
    let dh4_secret = await my_crypto.derive_dh(dh4.publicKey, dh4.privateKey);

    let shared_secret = await my_crypto.combine_buffers([dh1_secret, dh2_secret, dh3_secret, dh4_secret]);
    return shared_secret;

}
