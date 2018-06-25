import * as my_crypto from "../clean/crypto_wrappers";

import assert from "assert";
import  WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const WC = new WebCrypto();
const CS = WC.subtle;


export async function user(name, secret) {
    let u = {};
    u.name = name;
    u.send_key = null;
    u.new_send_key = false;
    u.recieve_key = null;
    u.root_key = null;
    u.send_chain_key = null;
    u.recieve_chain_key = null;
    return u;
}

export async function init_sender(user, secret_key, reciever_dh_public_key) {
    assert(typeof user.name === "string");
    assert(new DataView(secret_key).byteLength === 32);
    assert(reciever_dh_public_key.algorithm.name = "ECDH");
    assert(reciever_dh_public_key.type === "public");

    user.send_key = await my_crypto.generate_dh_key();
    user.new_send_key = true;
    user.recieve_key = reciever_dh_public_key;

    let kdf_out = await my_crypto.root_kdf_step(
        secret_key,
        await my_crypto.derive_dh(user.recieve_key, user.send_key.privateKey)
    );

    user.root_key = kdf_out.root_key;
    user.send_chain_key = kdf_out.chain_key;
}

export async function init_reciever(user, secret_key, reciever_dh_keypair) {
    assert(typeof user.name === "string");
    assert(new DataView(secret_key).byteLength === 32);
    assert(reciever_dh_keypair.publicKey.algorithm.name = "ECDH");
    assert(reciever_dh_keypair.publicKey.type === "public");
    assert(reciever_dh_keypair.privateKey.algorithm.name = "ECDH");
    assert(reciever_dh_keypair.privateKey.type === "private");

    user.send_key = reciever_dh_keypair;
    user.root_key = secret_key;
}
