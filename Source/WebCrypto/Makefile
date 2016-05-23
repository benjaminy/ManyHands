#
#
#

start_file_server:
	cd ../../Testing &&	node ../Source/simple_file_server.js Cloud 8123

start_mh_server:
	cd ../.. && node Source/WebCrypto/many_hands_server.js

clean_slate:
	cd ../.. && cp ./Testing/Users/login_links_empty.sqlite ./Testing/Users/login_links.sqlite && rm -rf ./Testing/Cloud/*
