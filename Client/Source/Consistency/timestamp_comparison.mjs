import assert from "assert";

export function compare(ts1, ts2) {
    var equality = 0;
    for (var user in ts1) {
        if (ts1[user] === ts2[user]) {
        }
        else if (ts1[user] > ts2[user]) {
            if (equality === -1) {
                equality = 0;
                break;
            }
            equality = 1;
        }
        else if (ts1[user] < ts2[user]) {
            if (equality === 1) {
                equality = 0;
                break;
            }
            equality = -1;
        }
    }

    // arbitrary case for concurrent edits
    if (equality === 0) {
        const ts1_string = JSON.stringify(ts1);
        const ts2_string = JSON.stringify(ts2);

        if (ts1_string < ts2_string) equality = -1;
        if (ts1_string > ts2_string) equality = 1;
        if (ts1_string === ts2_string) equality = 0;
    }

    return equality;

}
