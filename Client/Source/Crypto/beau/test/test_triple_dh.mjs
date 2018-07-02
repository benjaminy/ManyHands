import assert from "assert";
import * as crypto from "../clean/crypto_wrappers";
import * as double_ratchet from "../clean/double_ratchet"
import * as user from "../clean/user"
import * as messaging from "../clean/messaging"
import * as diffie from "../clean/triple_dh"


import WebCrypto from "node-webcrypto-ossl";
const WC = new WebCrypto();
const CS = WC.subtle;

import TextEncoder from "text-encoding";
const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

async function main() {
    await first_tipdif();
}
main();

async function first_tipdif() {
    named_log("testing initializing a user with their respective identity keys");

    let alice = await user.new_user("alice");
    let bob = await user.new_user("bob");

    let sender_dh_out = await diffie.sender_triple_diffie_hellman(
        alice.priv, bob.pub
    );

    assert(new DataView(sender_dh_out.shared_secret).byteLength === 128);
    assert(sender_dh_out.ephemeral_public_key.type === "public");
    assert(sender_dh_out.ephemeral_public_key.algorithm.name === "ECDH");


    let reciever_dh_out = await diffie.reciever_triple_diffie_hellman(
        alice.pub.id_dh, sender_dh_out.ephemeral_public_key, bob.priv
    );

    assert(reciever_dh_out.buffer === sender_dh_out.shared_secret.buffer);
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
