	var APP_KEY = "rwovrjf7g18ya3b";

	document.getElementById("dropbox_connect").onclick = handleAuthClick;
	var loginform = document.getElementById("login_form");

	var privKeyLink = "";
	var username = "";
	var decrypt_pass = "";

	loginform.onsubmit = function(evt){
		evt.preventDefault();

		username = document.getElementById("login_username").value;
		decrypt_pass = document.getElementById("decrypt_pass").value;

		var xmlhttp = new XMLHttpRequest();

		xmlhttp.onreadystatechange = makeFooCB(loginCallback);

		xmlhttp.open("GET", "http://localhost:8080/get_url?"+username+"", true);
		xmlhttp.send(null);
	}

	function handleAuthClick(e){
        window.open('https://www.dropbox.com/1/oauth2/authorize?client_id='+encodeURIComponent(APP_KEY)+'&response_type=token&redirect_uri='+encodeURIComponent(get_redirect_uri()), "_self");
	}

	function get_redirect_uri(){
		return "http://localhost:8080/firstconnect.html";
	}



	function downloadKey(){
		makeDownloadRequest("privKey", keyCallBack);
		makeDownloadRequest("salt1", salt1CallBack);
		makeDownloadRequest("salt2", salt2CallBack);
	}

	// function getPubLink(filename){
	// 	var xmlhttp = new XMLHttpRequest();

	// 	xmlhttp.onreadystatechange = makeFooCB(publinkCallBack);

	// 	xmlhttp.open("POST", "https://api.dropbox.com/1/shares/auto/"+filename+"?short_url=false",true);
	// 	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	// 	xmlhttp.send(null);
	// }

	function makeDownloadRequest(filename1, cb){
		var xmlhttp = new XMLHttpRequest();
		//filename = filename1;
		xmlhttp.onreadystatechange = makeFooCB(cb);
	
		xmlhttp.open("GET", "https://api-content.dropbox.com/1/files/auto/"+filename1+"", true);
		xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
		xmlhttp.send(null);

	}

	function downloadFile(download_url, cb){
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.onreadystatechange = makeFooCB(cb);

		xmlhttp.open("GET", download_url, true);
		xmlhttp.send(null)
	}

	function loginCallback(httpResponse){
		console.log(httpResponse);
		privKeyLink = httpResponse;
		downloadFile(privKeyLink, privKeyDecrypt);

	}

	function privKeyDecrypt()


	function foo(xhr, cb){
		if(xhr.readyState == 4 && xhr.status==200){
			cb(xhr.responseText);
		}
	}


	function decryptFile(fileBlob){
		var decrypted_data = sjcl.decrypt(decrypt_pass, fileBlob);
		decrypt_pass ="";
	}

	function makeFooCB(cb){
		return function(ev){
			foo(this, cb);
		}
	}
