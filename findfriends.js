var VK = require("VK-Promise");
var ProgressBar = require("progress");
var fs = require("fs");

Array.prototype.pushSet = function(el) {
	if (this.indexOf(el) != -1) return -1;
	return this.push(el);
}

var findfriends = {
	vk: null,
	_friendsQueue: [],
	_frineds: [],
	init: function(token) {
		this.vk = new VK(token);
		this.vk.init_execute_cart();
	},
	getUser: function(id, callback) {
		this.vk("users.get", {
			user_ids: id,
			fields: "relatives"
		}).then(function(user) {
			callback(user[0]);
		});
	},
	getHPFriends: function(id, callback) {
		this.vk("friends.get", {
			user_id: id
		}).then(function(response) {
			callback(response.items);
		});
	},
	getAllPosts: function(id, callback) {
		var _this = this;
		var max = 0;
		var posts = [];

		function getOnce(offset) {
			if (max && offset > max) return callback(posts);

			_this.vk("wall.get", {
				owner_id: id,
				count: 100,
				offset: offset,
				filter: "owner"
			}).then(function(res) {
				if (res.count == 0) return callback([]);
				if (!max) max = res.count;

				[].push.apply(posts, res.items);

				getOnce(offset + 100);
			});
		}

		getOnce(0);
	},
	getLikesForPosts: function(posts, callback) {
		var _this = this;

		if (!posts) return callback([]);

		var users = [];

		function getOnce(index) {
			if (index >= posts.length) return callback(users);

			_this.vk("likes.getList", {
				type: "post",
				owner_id: posts[index].owner_id,
				item_id: posts[index].id,
				count: 1000,
				filter: "likes"
			}).then(function(likes) {
				likes.items.forEach(l => users.pushSet(l));

				getOnce(index + 1);
			}).catch(function() {
				getOnce(index + 1);
			});
		}

		getOnce(0);
	},
	processFriendQueue: function(queue, target, callback) {
		var _this = this;
		var friends = [];

		var bar = new ProgressBar("Обрабатываю очередь [:bar] :percent Осталось: :etas", {
			total: queue.length
		});

		this.log = bar.interrupt.bind(bar);

		function getOnce(index) {
			_this.log("Завершено: " + index + "/" + queue.length);
			bar.tick();

			if (index >= queue.length) return callback(friends);

			_this.vk("friends.get", {
				user_id: queue[index]
			}).then(function(res) {
				function checkOnce(index2) {
					if (res.items.length > 500) return checkOnce(index2 + 1);

					if (index2 >= res.items.length) return getOnce(index + 1);

					_this.vk("friends.get", {
						user_id: res.items[index2]
					}).then(function(res2) {
						if (res2.items.indexOf(target) != -1) {
							friends.pushSet(res.items[index2]);
						}

						checkOnce(index2 + 1);
					}).catch(function() {
						checkOnce(index2 + 1);
					});
				}

				checkOnce(0);
			}).catch(function() {
				getOnce(index + 1);
			});
		}

		getOnce(0);
	},
	getHiddenFriends: function(id, callback) {
		console.log("FindFriends v0.0.0");
		console.log("Эта утилита позволит вам найти скрытых друзей пользователя вконтакте (но это не точно)");
		console.log("Если что, она делает это долго, ибо обращений к апи и проверок достаточно");
		console.log("Разработал: vk.com/topjs");
		console.log("OpenSource ;3");
		console.log("=".repeat(30));
		console.log("Лучше всего так-же давать токен, чтобы не было ограничений со стороны вк");
		console.log("=".repeat(30));

		var _this = this;

		console.log("Получаю список ТОЧНЫХ друзей пользователя (не скрытых)");

		this.getHPFriends(id, function(ids) {
			_this._friendsQueue = ids;
			_this._friends = ids;

			console.log("Получил " + ids.length + " друзей, добавляю в очередь");

			_this.getUser(id, function(user) {
				if (user.relatives) {
					console.log("У пользователя " + user.relatives.length + " родственников (или как тама), добавляю в очередь");

					user.relatives.map(r => _this._friendsQueue.pushSet(r.id));
				}

				console.log("Получаю все посты пользователя и выковыриваю из них лайки");

				_this.getAllPosts(id, function(posts) {
					console.log("Получил все посты, их там " + posts.length);
					console.log("Ковыряю лайки");

					_this.getLikesForPosts(posts, function(users) {
						console.log("Расковырял лайки, уникальных лайкеров " + users.length + ", добавляю угадайте куда");

						users.forEach(u => _this._friendsQueue.pushSet(u));

						console.log("Очередь сделана, там пользователей: " + _this._friendsQueue.length);
						console.log("А теперь можете сходить за чашкой чая, включить свою киношку и ждать, ждать и ждать.");
						console.log("Это будет оооооочень долго");
						console.log("Погнали");

						_this.processFriendQueue(_this._friendsQueue, id, function(friends) {
							_this.log("Ух-ты, оно закончилось!");
							_this.log("Всего найдено друзей: " + friends.length);
							_this.log("Фильтруем...");

							friends = friends.filter(f => _this._friends.indexOf(f) == -1);

							_this.log("Скрытых друзей у пользователя " + friends.length);

							if (friends.length == 0) _this.log("Вижу у твоей жертвы 0 скрытых друзей :D, зря потратил время");
							else _this.log("В файле friends.txt будут ссылки на всех скрытых друзей");

							fs.writeFileSync("./friends.txt", friends.map(u => "https://vk.com/id" + u).join("\n\r"));

							_this.log("Пока-пока");
						});
					});
				});
			});
		});
	}
}

module.exports = findfriends;