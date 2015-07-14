var finalhandler = require('finalhandler')
var http = require('http')
var serveStatic = require('serve-static')
var qs = require('querystring')
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('ManyHands');

var username = "";
var serve = serveStatic('.', {"index": ['index.html','index.htm']})


var server = http.createServer(function (req, res){

    if(req.method=="POST"){
        var body="";
        req.on('data', function (chunk){
            body += chunk.toString();
        });

        req.on('end', function(){
            var post = qs.parse(body);
            res.writeHead(200, "OK", {'Content-Type': 'text/html'});
            res.end();
            postReqCB(post);
        });
    }
    else{
        var done = finalhandler(req, res)
        serve(req, res, done)
    }
});

server.listen(8080);

console.log("Server Running on 8080");

function postReqCB(body){
    if(body['username']){
        username = body['username'];
        checkUser(username);
    }
    else{
        console.log("No username");
    }
}

function checkUser(username){
    db.all("SELECT * from user where uid="+username,function(err, rows){
        if(err) console.log(err.errno);
        else if(rows.length === 0){
            console.log("user does not exist. connect to dropbox");
        }
        else{
            console.log("user exists");
        }
    })

}

// var sys = require("sys"),
// my_http = require("http"),
// path = require("path"),
// url = require("url"),
// filesys = require("fs");
// serveStatic = require('serve-static')

// my_http.createServer(function(request,response){
//     var my_url = url.parse(request.url);
//     var my_path = my_url.pathname;
//     var full_path = path.join(process.cwd(),my_path);

//     if(my_path == "/getURL"){
//         getURL(response, my_url);
//     }

//     request.on("data", function(data){
//         response.end('data event: '+data);
//     });



//     filesys.exists(full_path,function(exists){
//         if(!exists){
//             response.writeHeader(404, {"Content-Type": "text/plain"});  
//             response.write("404 Not Found\n");  
//             response.end();
//         }
//         else{
//             filesys.readFile(full_path, "binary", function(err, file) {  
//                  if(err) {  
//                      response.writeHeader(500, {"Content-Type": "text/plain"});  
//                      response.write(err + "\n");  
//                      response.end();  
                 
//                  }  
//                  else{
//                     response.writeHeader(200);  
//                     response.write(file, "binary");  
//                     response.end();
//                 }
                      
//             });
//         }
//     });
// }).listen(8080);


