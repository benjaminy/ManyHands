import assert from "assert";
import * as user from "../clean/user"
import * as user_messaging from "../clean/user_messaging"
import * as crypto from "../clean/crypto_wrappers"

async function main() {
    await test_single_send_and_recieve();
}
main();

async function test_single_send_and_recieve() {
    named_log("test single send and recieve");

    const bob = await user.new_user("bob");
    const alice = await user.new_user("alice");

    let a2b = [];
    let b2a = [];

    let messages = [];
    // sending messages that are just buffers
    for (let i = 0; i < 20; i++) {
        messages.push(await crypto.encode_string(Math.random().toString()));
    }


    const message_buffer_0 = await user_messaging.create_user_message(alice, recipient_name, messages[0]);
    const message_buffer_1 = await user_messaging.create_user_message(alice, recipient_name, messages[1]);
    a2b.push(messages[0]);
    a2b.push(messages[1]);

    const message_0 = await user_messaging.parse_user_message(bob, message_buffer_0);
    const message_1 = await user_messaging.parse_user_message(bob, message_buffer_1);
    assert(message_0 === a2b.shift());
    assert(message_1 === a2b.shift());

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
