import assert from "assert";
import * as user from "../clean/user"
import * as crypto from "../clean/crypto_wrappers"
import * as timestamp from "../clean/timestamp_comparison"

async function main() {
    await test_simple_2_user_concurrent();
    await test_2_user_identical();
    await test_many_user_concurrent();
    await test_many_user_concurrent();
    await test_greater_than_with_2_mismatched_users();
    await test_less_than_2_users();
    await test_less_than_with_2_mismatched_users();
}
main();

export async function test_simple_2_user_concurrent() {
    named_log("testing findng if two timestamps are concurrent when equal");
    const ts1 = {
        "Alice": 0,
        "Bob": 0
    }

    const ts2 = {
        "Alice": 0,
        "Bob": 0
    }

    const comparison = await timestamp.compare(ts1, ts2);
    assert(comparison === 0);
    success();
}

export async function test_2_user_identical() {
    named_log("testing findng if two identicial timestamps are concurrent when mismatched");
    const ts1 = {
        "Alice": 0,
        "Bob": 1
    }

    const ts2 = {
        "Alice": 0,
        "Bob": 1
    }

    const comparison = await timestamp.compare(ts1, ts2);
    assert(comparison === 0);
    success();
}

export async function test_many_user_concurrent() {
    named_log("testing findng if two timestamps are concurrent with more than 2 people");
    const ts1 = {
        "Alice": 1,
        "Bob": 0,
        "Carol": 1,
    }

    const ts2 = {
        "Alice": 0,
        "Bob": 1,
        "Carol": 0
    }

    const comparison = await timestamp.compare(ts1, ts2);
    assert(comparison != 0);
    success();
}

export async function test_greater_than_2_users() {
    named_log("testing greater than in a simple case with two users");
    const ts1 = {
        "Alice": 1,
        "Bob": 0
    }

    const ts2 = {
        "Alice": 0,
        "Bob": 0
    }

    const comparison = await timestamp.compare(ts1, ts2);
    assert(comparison === 1);
    success();
}

export async function test_greater_than_with_2_mismatched_users() {
    named_log("testing greater than with two mismatched user stamps");
    const ts1 = {
        "Alice": 1,
        "Bob": 1
    }

    const ts2 = {
        "Alice": 0,
        "Bob": 0
    }

    const comparison = await timestamp.compare(ts1, ts2);
    assert(comparison === 1);
    success();
}


export async function test_less_than_2_users() {
    named_log("testing less than in a simple case with two users");
    const ts1 = {
        "Alice": 1,
        "Bob": 0
    }

    const ts2 = {
        "Alice": 0,
        "Bob": 0
    }

    const comparison = await timestamp.compare(ts1, ts2);
    assert(comparison === 1);
    success();
}

export async function test_less_than_with_2_mismatched_users() {
    named_log("testing less than with two mismatched user stamps");
    const ts1 = {
        "Alice": 1,
        "Bob": 1
    }

    const ts2 = {
        "Alice": 0,
        "Bob": 0
    }

    const comparison = await timestamp.compare(ts1, ts2);
    assert(comparison === 1);
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
