import assert from "assert";
import * as user from "../clean/user"
import * as group_messaging from "../clean/group_messaging"
import * as crypto from "../clean/crypto_wrappers"

async function main() {
    await test_creating_a_group();
}
main();

async function test_creating_a_group() {
    named_log("testing creating a new group with alice bob and carol")
    const bob = await user.new_user("bob");
    const alice = await user.new_user("alice");
    const carol = await user.new_user("carol");

    const new_group = await group_messaging.create_new_group(
        "cool kids club", [bob.pub, alice.pub, carol.pub]
    );


    assert(Array.isArray(alice.pub.user_outboxes.bob));
    assert(Array.isArray(alice.pub.user_outboxes.carol));
    assert(Array.isArray(alice.pub.group_outboxes["cool kids club"]));

    assert(Array.isArray(bob.pub.user_outboxes.alice));
    assert(Array.isArray(bob.pub.user_outboxes.carol));
    assert(Array.isArray(bob.pub.group_outboxes["cool kids club"]));

    assert(Array.isArray(carol.pub.user_outboxes.alice));
    assert(Array.isArray(carol.pub.user_outboxes.bob));
    assert(Array.isArray(carol.pub.group_outboxes["cool kids club"]));

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
