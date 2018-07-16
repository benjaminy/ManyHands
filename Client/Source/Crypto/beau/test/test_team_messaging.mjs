import assert from "assert";
import * as user from "../clean/user"
import * as crypto from "../clean/crypto_wrappers"
import * as team_messaging from "../clean/team_messaging"

async function main() {
    await test_creating_a_group();
    await test_sending_single_message_to_group();
    await test_sending_messages_back_and_forth();
    await test_async_sending_and_recieving();
    await test_3_way_sending_and_recieving();
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

    assert(bob.priv.teams.g1.log[0] === "the lazy brown fox jumps over the log");
    assert(carol.priv.teams.g1.log[0] === "the lazy brown fox jumps over the log");

    assert(alice.priv.teams.g1.timestamp.alice == 1);
    assert(alice.priv.teams.g1.timestamp.bob == 0);
    assert(alice.priv.teams.g1.timestamp.carol == 0);

    assert(bob.priv.teams.g1.timestamp.alice == 1);
    assert(bob.priv.teams.g1.timestamp.bob == 1);
    assert(bob.priv.teams.g1.timestamp.carol == 0);

    assert(carol.priv.teams.g1.timestamp.alice == 1);
    assert(carol.priv.teams.g1.timestamp.bob == 0);
    assert(carol.priv.teams.g1.timestamp.carol == 1);



    success();
}

async function test_sending_messages_back_and_forth() {
    named_log("testing sending multiple messages to a group");

    const alice = await user.new_user("alice");
    const bob = await user.new_user("bob");
    const new_group = await team_messaging.create_new_team("g1", [alice, bob]);

    const a2b = [];
    const b2a = [];

    let messages = [];
    for (let i = 0; i < 20; i++) {
        messages.push(Math.random().toString());
    }

    await team_messaging.upload_team_message(alice, "g1", messages[0]);
    await team_messaging.upload_team_message(alice, "g1", messages[1]);
    a2b.push(messages[0]);
    a2b.push(messages[1]);

    await team_messaging.download_team_messages(bob, "g1");
    await team_messaging.download_team_messages(bob, "g1");
    assert(bob.priv.teams.g1.log[0] === a2b[0]);
    assert(bob.priv.teams.g1.log[1] === a2b[1]);

    await team_messaging.upload_team_message(bob, "g1", messages[2]);
    await team_messaging.upload_team_message(bob, "g1", messages[3]);
    b2a.push(messages[2]);
    b2a.push(messages[3]);

    await team_messaging.download_team_messages(alice, "g1");
    await team_messaging.download_team_messages(alice, "g1");
    assert(alice.priv.teams.g1.log[0] === b2a[0]);
    assert(alice.priv.teams.g1.log[1] === b2a[1]);

    await team_messaging.upload_team_message(alice, "g1", messages[4]);
    await team_messaging.upload_team_message(alice, "g1", messages[5]);
    a2b.push(messages[4]);
    a2b.push(messages[5]);

    await team_messaging.download_team_messages(bob, "g1");
    await team_messaging.download_team_messages(bob, "g1");
    assert(bob.priv.teams.g1.log[2] === a2b[2]);
    assert(bob.priv.teams.g1.log[3] === a2b[3]);

    await team_messaging.upload_team_message(bob, "g1", messages[6]);
    await team_messaging.upload_team_message(bob, "g1", messages[7]);
    b2a.push(messages[6]);
    b2a.push(messages[7]);

    await team_messaging.download_team_messages(alice, "g1");
    await team_messaging.download_team_messages(alice, "g1");
    
    assert(alice.priv.teams.g1.log[2] === b2a[2]);
    assert(alice.priv.teams.g1.log[3] === b2a[3]);

    assert(alice.priv.teams.g1.timestamp.alice == 8);
    assert(alice.priv.teams.g1.timestamp.bob == 8);

    assert(bob.priv.teams.g1.timestamp.alice == 6);
    assert(bob.priv.teams.g1.timestamp.bob == 8);

    success();
}

async function test_async_sending_and_recieving() {
    named_log("testing async sending and recieving in group");

    const alice = await user.new_user("alice");
    const bob = await user.new_user("bob");
    const new_group = await team_messaging.create_new_team("g1", [alice, bob]);

    const a2b = [];
    const b2a = [];

    let messages = [];
    for (let i = 0; i < 20; i++) {
        messages.push(Math.random().toString());
    }

    await team_messaging.upload_team_message(alice, "g1", messages[0]);
    await team_messaging.upload_team_message(alice, "g1", messages[1]);
    a2b.push(messages[0]);
    a2b.push(messages[1]);

    await team_messaging.download_team_messages(bob, "g1");
    await team_messaging.download_team_messages(bob, "g1");
    assert(bob.priv.teams.g1.log[0] === a2b[0]);
    assert(bob.priv.teams.g1.log[1] === a2b[1]);

    await team_messaging.upload_team_message(bob, "g1", messages[2]);
    await team_messaging.upload_team_message(bob, "g1", messages[3]);
    b2a.push(messages[2]);
    b2a.push(messages[3]);

    await team_messaging.upload_team_message(alice, "g1", messages[4]);
    await team_messaging.upload_team_message(alice, "g1", messages[5]);
    a2b.push(messages[4]);
    a2b.push(messages[5]);

    await team_messaging.download_team_messages(bob, "g1");
    await team_messaging.download_team_messages(bob, "g1");
    assert(bob.priv.teams.g1.log[2] === a2b[2]);
    assert(bob.priv.teams.g1.log[3] === a2b[3]);

    await team_messaging.download_team_messages(alice, "g1");
    await team_messaging.download_team_messages(alice, "g1");
    assert(alice.priv.teams.g1.log[0] === b2a[0]);
    assert(alice.priv.teams.g1.log[1] === b2a[1]);


    await team_messaging.upload_team_message(bob, "g1", messages[6]);
    await team_messaging.upload_team_message(bob, "g1", messages[7]);
    b2a.push(messages[6]);
    b2a.push(messages[7]);


    await team_messaging.download_team_messages(alice, "g1");
    await team_messaging.download_team_messages(alice, "g1");
    assert(alice.priv.teams.g1.log[2] === b2a[2]);
    assert(alice.priv.teams.g1.log[3] === b2a[3]);

    success();
}

async function test_3_way_sending_and_recieving() {
    named_log("test 3 way sedning and recieving");

    const alice = await user.new_user("alice");
    const bob = await user.new_user("bob");
    const carol = await user.new_user("carol");
    const new_group = await team_messaging.create_new_team("g1", [alice, bob, carol]);

    const a2b = [];
    const a2c = [];

    const b2a = [];
    const b2c = [];

    const c2a = [];
    const c2b = [];

    let messages = [];
    for (let i = 0; i < 20; i++) {
        messages.push(Math.random().toString());
    }

    await team_messaging.upload_team_message(alice, "g1", messages[0]);
    await team_messaging.upload_team_message(alice, "g1", messages[1]);
    a2b.push(messages[0]);
    a2b.push(messages[1]);
    a2c.push(messages[0]);
    a2c.push(messages[1]);

    await team_messaging.download_team_messages(bob, "g1");
    await team_messaging.download_team_messages(bob, "g1");
    assert(bob.priv.teams.g1.log[0] === a2b[0]);
    assert(bob.priv.teams.g1.log[1] === a2b[1]);

    await team_messaging.download_team_messages(carol, "g1");
    await team_messaging.download_team_messages(carol, "g1");
    assert(carol.priv.teams.g1.log[0] === a2c[0]);
    assert(carol.priv.teams.g1.log[1] === a2c[1]);




    await team_messaging.upload_team_message(bob, "g1", messages[2]);
    await team_messaging.upload_team_message(bob, "g1", messages[3]);
    b2a.push(messages[2]);
    b2a.push(messages[3]);
    b2c.push(messages[2]);
    b2c.push(messages[3]);

    await team_messaging.download_team_messages(alice, "g1");
    await team_messaging.download_team_messages(alice, "g1");
    assert(alice.priv.teams.g1.log[0] === b2a[0]);
    assert(alice.priv.teams.g1.log[1] === b2a[1]);

    await team_messaging.download_team_messages(carol, "g1");
    await team_messaging.download_team_messages(carol, "g1");
    assert(carol.priv.teams.g1.log[2] === b2c[0]);
    assert(carol.priv.teams.g1.log[3] === b2c[1]);




    await team_messaging.upload_team_message(carol, "g1", messages[4]);
    await team_messaging.upload_team_message(carol, "g1", messages[5]);
    c2a.push(messages[4]);
    c2a.push(messages[5]);
    c2b.push(messages[4]);
    c2b.push(messages[5]);

    await team_messaging.download_team_messages(bob, "g1");
    await team_messaging.download_team_messages(bob, "g1");
    assert(bob.priv.teams.g1.log[2] === c2b[0]);
    assert(bob.priv.teams.g1.log[3] === c2b[1]);

    await team_messaging.download_team_messages(alice, "g1");
    await team_messaging.download_team_messages(alice, "g1");
    assert(alice.priv.teams.g1.log[2] === c2a[0]);
    assert(alice.priv.teams.g1.log[3] === c2a[1]);

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
