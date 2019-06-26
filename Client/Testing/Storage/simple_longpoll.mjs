import T       from "transit-js";

export async function longPollTests( s ){
  const link = T.map();
  const path = //seomtjing ;
  link.set("path",`${path}`);
  const etag = //something ;
  const options = {
    etag: etag
    timeoutLength: 40000
  }
  s.watch(link,options);
}
