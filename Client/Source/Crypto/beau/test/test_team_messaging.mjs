import assert from "assert";
import * as user from "../clean/user"
import * as crypto from "../clean/crypto_wrappers"
import * as team_messaging from "../clean/team_messaging"

async function main() {
    await test_creating_a_group();
    await test_creating_two_groups_with_shared_members();
    await test_sending_single_message_to_group();
}
main();

async function test_creating_a_group() {
    named_log("testing creating a new group with alice bob and carol")
    const bob = await user.new_user("bob");
    const alice = await user.new_user("alice");
    const carol = await user.new_user("carol");

    const new_group = await team_messaging.create_new_team(
        "cool kids club", [bob.pub, alice.pub, carol.pub]
    );

    assert(Array.isArray(alice.pub.user_outboxes[bob.pub.uid]["cool kids club"]));
    assert(Array.isArray(alice.pub.user_outboxes[carol.pub.uid]["cool kids club"]));

    assert(Array.isArray(bob.pub.user_outboxes[alice.pub.uid]["cool kids club"]));
    assert(Array.isArray(bob.pub.user_outboxes[carol.pub.uid]["cool kids club"]));

    assert(Array.isArray(carol.pub.user_outboxes[alice.pub.uid]["cool kids club"]));
    assert(Array.isArray(carol.pub.user_outboxes[bob.pub.uid]["cool kids club"]));

    assert(Array.isArray(alice.pub.group_outboxes["cool kids club"]))
    assert(Array.isArray(bob.pub.group_outboxes["cool kids club"]))
    assert(Array.isArray(carol.pub.group_outboxes["cool kids club"]))

    assert(alice.pub.groups[0] === "cool kids club");
    assert(bob.pub.groups[0] === "cool kids club");
    assert(carol.pub.groups[0] === "cool kids club");

    success();
}


async function test_creating_two_groups_with_shared_members() {
    named_log("testing creating a new group with alice bob and carol")
    const bob = await user.new_user("bob");
    const alice = await user.new_user("alice");
    const carol = await user.new_user("carol");
    const dave = await user.new_user("dave");

    const group_1 = await team_messaging.create_new_team(
        "g1", [alice.pub, bob.pub, carol.pub]
    );

    const group_2 = await team_messaging.create_new_team(
        "g2", [bob.pub, carol.pub, dave.pub]
    );

    console.log(bob.pub.user_outboxes);
    console.log(bob.pub.group_outboxes);

    assert("g1" in bob.pub.user_outboxes.alice);
    assert("g1" in bob.pub.user_outboxes.carol);

    assert("g2" in bob.pub.user_outboxes.carol);
    assert("g2" in bob.pub.user_outboxes.dave);

    assert(bob.pub.groups[0] === "g1");
    assert(bob.pub.groups[1] === "g2");

    assert(Array.isArray(bob.pub.group_outboxes.g1))
    assert(Array.isArray(bob.pub.group_outboxes.g2))

    success();
}


async function test_sending_single_message_to_group() {
    named_log("testing sending a singl message to a group");

    const bob = await user.new_user("bob");
    const alice = await user.new_user("alice");
    const carol = await user.new_user("carol");

    const new_group = await team_messaging.create_new_team(
        "g1", [bob.pub, alice.pub, carol.pub]
    );

    await team_messaging.upload_team_message(alice, 0, "the lazy brown fox jumps over the log");

    // assert(await crypto.decode_string(alice.pub.group_outboxes.g1[0]) === "the lazy brown fox jumps over the log");
    // assert(alice.pub.user_outboxes.bob[0].byteLength > 0);
    // assert(alice.pub.user_outboxes.carol[0].byteLength > 0);

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
