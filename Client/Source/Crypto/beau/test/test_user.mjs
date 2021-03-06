import assert from "assert";
import * as user from "../clean/user"
import * as crypto from "../clean/crypto_wrappers"


import WebCrypto from "node-webcrypto-ossl";
const WC = new WebCrypto();
const CS = WC.subtle;

async function main() {
    await test_init_id_keys();
    await test_init_signed_prekey();
    await test_init_one_time_prekeys();
    await test_init_conversation_fields();
    await test_creating_new_conversations();
}
main();

async function test_init_id_keys() {
    named_log("testing id_dh and id_dsa key creation");

    const bob = await user.new_user("bob");

    assert(bob.pub.id_dh.type === "public");
    assert(bob.pub.id_dsa.type === "public");

    assert(bob.priv.id_dh.type === "private");
    assert(bob.priv.id_dsa.type === "private");

    assert(bob.pub.id_dh.algorithm.name === "ECDH");
    assert(bob.pub.id_dsa.algorithm.name === "ECDSA");

    assert(bob.priv.id_dh.algorithm.name === "ECDH");
    assert(bob.priv.id_dsa.algorithm.name === "ECDSA");

    success();

}

async function test_init_signed_prekey() {
    named_log("testing the creation of the signed prekey");
    const bob = await user.new_user();

    assert(bob.pub.prekey.type === "public");
    assert(bob.pub.prekey.algorithm.name === "ECDH");

    assert(bob.priv.prekey.type === "private");
    assert(bob.priv.prekey.algorithm.name === "ECDH");

    assert(new DataView(bob.pub.prekey_signature).byteLength > 0);

    const key_verification = await crypto.verify_key_signature(
        bob.pub.id_dsa,
        bob.pub.prekey,
        bob.pub.prekey_signature
    );

    assert(key_verification);

    success();
}


async function test_init_one_time_prekeys() {
    named_log("testing the creation of the one time prekey arrays");
    const bob = await user.new_user("bob");

    assert(Array.isArray(bob.pub.otpks));
    assert(bob.pub.otpks.length > 0);

    assert(Array.isArray(bob.priv.otpks));
    assert(bob.priv.otpks.length > 0);

    for (let i = 0; i < bob.pub.otpks; i++) {
        assert(bob.pub.otpks[i].type === "public");
        assert(bob.priv.otpks[i].type === "private");

        assert(bob.pub.otpks[i].algorithm.name === "ECDH");
        assert(bob.priv.otpks[i].algorithm.name === "ECDH");
    }

    success();
}

async function test_init_conversation_fields() {
    named_log("testing the conversation field and inbox field");
    const bob = await user.new_user("bob");

    assert(typeof bob.priv.conversations === "object");
    assert(Array.isArray(bob.pub.inbox));

    success();
}

async function test_creating_new_conversations() {
    named_log("testing creating the new fields for a conversation");
    const bob = await user.new_user("bob");
    const alice = await user.new_user("alice");

    const shared_secret = WC.getRandomValues(new Uint8Array(32)).buffer;

    bob.priv.conversations.alice = await user.init_conversation_keys(shared_secret);
    alice.priv.conversations.bob = await user.init_conversation_keys(shared_secret);

    const bob_alice_conversation_string = JSON.stringify(bob.priv.conversations.alice);
    const alice_bob_conversation_string = JSON.stringify(alice.priv.conversations.bob);

    assert(bob_alice_conversation_string === alice_bob_conversation_string);
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
