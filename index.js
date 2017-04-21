var findfriends = require("./findfriends");

findfriends.init(process.argv[3]);
findfriends.getHiddenFriends(~~process.argv[2]);