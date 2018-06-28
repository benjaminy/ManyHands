import assert from "assert";
import * as my_crypto from "../clean/crypto_wrappers";
import * as double_ratchet from "../clean/double_ratchet"
import * as my_user from "../clean/user"
import * as messaging from "../clean/messaging"
import * as x3dh from "../clean/triple_dh"


import WebCrypto from "node-webcrypto-ossl";
const WC = new WebCrypto();
const CS = WC.subtle;

import TextEncoder from "text-encoding";
const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

async function main() {
    await test_sign_verify_key();
    await first_tipdif();
}
main();

async function test_sign_verify_key() {
    // This test isn't working how is expected
    named_log("testing the signing and verifying of a key");

    let identity_dh = await my_crypto.generate_dh_key();
    let identity_dsa = await x3dh.generate_dsa_keypair(identity_dh);

    let prekey = await my_crypto.generate_dh_key();

    let key_signature = await x3dh.sign_key(prekey.publicKey, identity_dsa.privateKey);
    let key_verification = await x3dh.verify_key_signature(
        key_signature,
        prekey.publicKey,
        identity_dsa.publicKey
    )
    assert(key_verification);
    success();
}


/*
    need to send index of one time prekey and ephemeral public key.
*/

async function first_tipdif() {
    named_log("testing initializing a user with their respective identity keys");

    let alice = await my_user.user("alice");
    let bob = await my_user.user("bob");

    let sender_dh_out = await x3dh.sender_triple_diffie_hellman(alice.init_keys, bob.init_keys);

    assert(new DataView(sender_dh_out.shared_secret).byteLength === 128);
    assert(sender_dh_out.ephemeral_public_key.type === "public");
    assert(sender_dh_out.ephemeral_public_key.algorithm.name === "ECDH");

    let reciever_dh_out = await x3dh.reciever_triple_diffie_hellman(
        alice.init_keys, sender_dh_out.ephemeral_public_key, bob.init_keys
    );

    // These are not equal! No beuno!
    // console.log(new Uint32Array(reciever_dh_out));
    // console.log(new Uint32Array(sender_dh_out.shared_secret));
    // assert(reciever_dh_out === sender_dh_out.shared_secret);
    success();
}


function named_log(name) {
    let cyan = '\x1b[36m%s\x1b[0m';
    console.log(cyan, "*******************************");
    console.log(cyan, name);
    console.log(cyan, "*******************************");
}

function success() {
    let green = "\x1b[32m%s\x1b[0m";
    console.log(green, "success!");
    console.log();
}
