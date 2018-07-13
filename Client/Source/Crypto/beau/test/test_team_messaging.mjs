import assert from "assert";
import * as user from "../clean/user"
import * as crypto from "../clean/crypto_wrappers"
import * as team_messaging from "../clean/team_messaging"

async function main() {
    await test_creating_a_group();
    await test_sending_single_message_to_group();
}
main();

async function test_creating_a_group() {
    named_log("testing creating a new group with alice bob and carol")
    const alice = await user.new_user("alice");
    const bob = await user.new_user("bob");
    const carol = await user.new_user("carol");

    const new_group = await team_messaging.create_new_team("g1", [alice, bob, carol]);

    assert(Array.isArray(alice.pub.teams.g1.outbox));
    assert(Array.isArray(bob.pub.teams.g1.outbox));
    assert(Array.isArray(carol.pub.teams.g1.outbox));

    assert(Array.isArray(alice.pub.users.g1.bob.outbox));
    assert(Array.isArray(alice.pub.users.g1.carol.outbox));

    assert(Array.isArray(bob.pub.users.g1.alice.outbox));
    assert(Array.isArray(bob.pub.users.g1.carol.outbox));

    assert(Array.isArray(carol.pub.users.g1.alice.outbox));
    assert(Array.isArray(carol.pub.users.g1.bob.outbox));

    assert(alice.priv.teams.g1.timestamp);
    assert(bob.priv.teams.g1.timestamp);
    assert(carol.priv.teams.g1.timestamp);

    assert(alice.priv.users.g1.bob.conversation);
    assert(alice.priv.users.g1.carol.conversation);

    assert(bob.priv.users.g1.alice.conversation);
    assert(bob.priv.users.g1.carol.conversation);

    assert(carol.priv.users.g1.alice.conversation);
    assert(carol.priv.users.g1.bob.conversation);


    assert(alice.priv.teams.g1.members[0].uid === "bob");
    assert(alice.priv.teams.g1.members[1].uid === "carol");

    assert(bob.priv.teams.g1.members[0].uid === "alice");
    assert(bob.priv.teams.g1.members[1].uid === "carol");

    assert(carol.priv.teams.g1.members[0].uid === "alice");
    assert(carol.priv.teams.g1.members[1].uid === "bob");

    success();
}

async function test_sending_single_message_to_group() {
    named_log("testing sending a singl message to a group");

    const bob = await user.new_user("bob");
    const alice = await user.new_user("alice");
    const carol = await user.new_user("carol");
    const new_group = await team_messaging.create_new_team("g1", [bob, alice, carol]);

    await team_messaging.upload_team_message(alice, "g1", "the lazy brown fox jumps over the log");

    await team_messaging.download_team_messages(bob, "g1");

    await team_messaging.download_team_messages(carol, "g1");

    // assert(await crypto.decode_string(alice.pub.teams.g1.outbox[0]) === "the lazy brown fox jumps over the log");

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
