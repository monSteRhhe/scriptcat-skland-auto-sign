// ==UserScript==
// @name         森空岛每日签到
// @version      1.0.1
// @author       monSteRhhe
// @icon         https://bbs.hycdn.cn/public/skland-web/image/11a014c95c5ee68fe26c17995aa44a64.png
// @crontab      * * once * *
// @grant        GM_info
// @grant        GM_notification
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @connect      skland.com
// @connect      hypergryph.com
// ==/UserScript==

return new Promise((resolve, reject) => {
    /**
     * 确认登录状态
     */
    let token_code_url = "https://web-api.skland.com/account/info/hg",
    skland_url = "https://www.skland.com/"; // 森空岛
    GM_xmlhttpRequest({
        method: "GET",
        url: token_code_url,
        onload: (response) => {
            if (response.status == 200) {
                let response_json = eval("(" + response.response + ")"),
                token_code = response_json.data.content;
                doSign(token_code);
            } else {
                // 登录状态失效
                GM_notification({
                    text: "登录状态失效，点击进入森空岛网站重新登录。",
                    title: GM_info.script.name,
                    image: GM_info.script.icon,
                    onclick: () => {
                        GM_openInTab(skland_url);
                    }
                });
                reject("error"); 
            }
            resolve("ok"); // 执行成功
        },
        onerror() {
            reject("error"); // 执行失败,并返回错误原因
        },
    });

    /**
     * 执行签到
     */
    function doSign(token) {
        let grant_code_url = "https://as.hypergryph.com/user/oauth2/v2/grant", // 使用token获得认证代码
        app_code = "4ca99fa6b56cc2ba",
        json_data = {
            "appCode": app_code,
            "token": token,
            "type": 0
        },
        cred = "";

        GM_xmlhttpRequest({
            method: "POST",
            url: grant_code_url,
            data: JSON.stringify(json_data),
            headers: {
                "User-Agent": "Skland/1.0.1 (com.hypergryph.skland; build:100001014; Android 31; ) Okhttp/4.11.0",
                "Accept-Encoding": "gzip",
                "Connection": "close"
            },
            onload: (response) => {
                if (response.status == 200) {
                    let response_json = eval("(" + response.response + ")");
                    if (response_json.status == 0) {
                        let grant_code = response_json.data.code,
                        cred_code_url = "https://zonai.skland.com/api/v1/user/auth/generate_cred_by_code", // 使用认证代码获得cred
                        json_data = {
                            "code": grant_code,
                            "kind": 1
                        };

                        GM_xmlhttpRequest({
                            method: "POST",
                            url: cred_code_url,
                            data: JSON.stringify(json_data),
                            headers: {
                                "User-Agent": "Skland/1.0.1 (com.hypergryph.skland; build:100001014; Android 31; ) Okhttp/4.11.0",
                                "Accept-Encoding": "gzip",
                                "Connection": "close",
                                "Content-Type": "application/json; charset=utf-8"
                            },
                            onload: (response) => {
                                if (response.status == 200) {
                                    let response_json = eval("(" + response.response + ")");
                                    if (response_json.code == 0) {
                                        cred = response_json.data.cred;

                                        header = {
                                            "cred": cred,
                                            "User-Agent": "Skland/1.0.1 (com.hypergryph.skland; build:100001014; Android 31; ) Okhttp/4.11.0",
                                            "Accept-Encoding": "gzip",
                                            "Connection": "close",
                                            "Content-Type": "application/json; charset=utf-8"
                                        },
                                        chara = [],
                                        sign_url = "https://zonai.skland.com/api/v1/game/attendance", // 签到url
                                        binding_url = "https://zonai.skland.com/api/v1/game/player/binding"; // 绑定角色url

                                        GM_xmlhttpRequest({
                                            method: "GET",
                                            url: binding_url,
                                            headers: header,
                                            onload: (response) => {
                                                let response_json = eval("(" + response.response + ")");
                                                if (response_json.code == 0) {
                                                    for (let i of response_json.data.list) {
                                                        if (i["appCode"] != "arknights") {
                                                            continue;
                                                        }
                                                        chara.push(i["bindingList"]);
                                                    }

                                                    for (let i in chara) {
                                                        for (let j in chara[i]) {
                                                            let body = {
                                                                "uid": chara[i][j]["uid"],
                                                                "gameId": chara[i][j]["channelMasterId"]
                                                            };

                                                            GM_xmlhttpRequest({
                                                                method: "POST",
                                                                url: sign_url,
                                                                data: JSON.stringify(body),
                                                                headers: header,
                                                                onload: (response) => {
                                                                    let response_json = eval("(" + response.response + ")");
                                                                    console.log(response_json);
                                                                    if (response_json.code == 0) {
                                                                        let awards = response_json.data.awards;
                                                                        for (let k of awards) {
                                                                            let res = k["resource"];
                                                                            GM_notification({
                                                                                text: "角色" + chara[i][j]["nickName"] + "(" + chara[i][j]["channelName"] + ")签到成功，获得了" + res["name"] + "×" + k["count"],
                                                                                title: GM_info.script.name,
                                                                                image: GM_info.script.icon,
                                                                            });
                                                                        }
                                                                    } else {
                                                                        GM_notification({
                                                                            text: "角色" + chara[i][j]["nickName"] + "(" + chara[i][j]["channelName"] + ")签到失败，原因：" + response_json["message"],
                                                                            title: GM_info.script.name,
                                                                            image: GM_info.script.icon,
                                                                        });
                                                                    }
                                                                }
                                                            })
                                                        }
                                                    }
                                                }
                                            }
                                        })
                                    } else {
                                        GM_notification({
                                            text: "获得cred失败：" + response_json.message,
                                            title: GM_info.script.name,
                                            image: GM_info.script.icon,
                                        });
                                        reject("error"); 
                                    }
                                }
                            }
                        })
                    } else {
                        GM_notificatsion({
                            text: "获得认证代码失败：" + response_json.msg,
                            title: GM_info.script.name,
                            image: GM_info.script.icon,
                        });
                        reject("error"); 
                    }
                }
            }
        })
    }
});