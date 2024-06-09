// ==UserScript==
// @name         森空岛每日自动签到
// @version      1.2.1
// @author       monSteRhhe
// @icon         https://bbs.hycdn.cn/public/skland-web/image/11a014c95c5ee68fe26c17995aa44a64.png
// @crontab      * * once * *
// @grant        unsafeWindow
// @grant        GM_info
// @grant        GM_notification
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @connect      skland.com
// @connect      hypergryph.com
// @require      https://cdn.bootcdn.net/ajax/libs/crypto-js/4.2.0/crypto-js.min.js
// ==/UserScript==

return new Promise((resolve, reject) => {
    let token_code_url = 'https://web-api.skland.com/account/info/hg',
        skland_url = 'https://www.skland.com',
        grant_code_url = 'https://as.hypergryph.com/user/oauth2/v2/grant',
        cred_code_url = 'https://zonai.skland.com/api/v1/user/auth/generate_cred_by_code',
        binding_url = 'https://zonai.skland.com/api/v1/game/player/binding',
        sign_url = 'https://zonai.skland.com/api/v1/game/attendance',
        app_code = '4ca99fa6b56cc2ba',
        header_login = {
            'User-Agent': 'Skland/1.9.0 (com.hypergryph.skland; build:100900069; Android 29; ) Okhttp/4.11.0',
            'Accept-Encoding': 'gzip',
            'Connection': 'close',
            'Origin': 'https://www.skland.com',
            'Referer': 'https://www.skland.com/',
            'Content-Type': 'application/json; charset=utf-8'
        },
        sign_header = {
            'platform': '1',
            'timestamp': '',
            'dId': '29fde8ff236bcf7c',
            'vName': '1.9.0'
        };

    do_init();

    /**
     * 初始化运行
     */
    async function do_init() {
        let token = await wait_promise(login_by_token()),
            cred_response = await wait_promise(get_cred_by_token(token));
        do_sign(cred_response);
    }

    /**
     * 通过 Token 登录
     * @returns Token Code
     */
    function login_by_token() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: token_code_url,
                responseType: 'json',
                onload: async (xhr) => {
                    if (xhr.response.code == 0) {
                        resolve(xhr.response.data.content);
                    } else {
                        // 登录状态失效
                        GM_notification({
                            text: '登录状态失效，点击进入森空岛网站重新登录。',
                            title: GM_info.script.name,
                            image: GM_info.script.icon,
                            onclick: () => {
                                GM_openInTab(skland_url);
                            }
                        });
                        reject('error');
                    }
                }
            });
            
        })
    }

    /**
     * 等待返回异步执行结果
     * @param {function} func 传递的异步函数
     * @returns 异步执行结果
     */
    async function wait_promise(func) {
        let data = await func;
        return data;
    }

    /**
     * 获取 OAuth2 授权代码
     * @param {string} token 账号登录凭证
     */
    function get_grant_code(token) {
        return new Promise((resolve, reject) => {
            let data = {
                'token': token,
                'appCode': app_code,
                'type': 0
            };
            GM_xmlhttpRequest({
                method: 'POST',
                url: grant_code_url,
                headers: header_login,
                data: JSON.stringify(data),
                responseType: 'json',
                onload: async (xhr) => {
                    if (xhr.status == 200) {
                        resolve(xhr.response.data.code);
                    } else {
                        reject('error');
                    }
                }
            });
        })
    }

    /**
     * 通过 OAuth2 授权代码获取 Cred
     * @param {string} grant_code OAuth2 授权代码
     * @returns Cred
     */
    function get_cred(grant_code) {
        return new Promise((resolve, reject) => {
            let data = {
                'kind': 1,
                'code': grant_code
            };
            GM_xmlhttpRequest({
                method: 'POST',
                url: cred_code_url,
                headers: header_login,
                data: JSON.stringify(data),
                responseType: 'json',
                onload: async (xhr) => {
                    if (xhr.status == 200) {
                        resolve(xhr.response.data);
                    } else {
                        reject('error');
                    }
                }
            });
        })
    }

    /**
     * 获取 Cred
     * @param {string} token 账号登录凭证
     * @returns 包含 Cred 和用户 ID 的 JSON 数据
     */
    async function get_cred_by_token(token) {
        let grant_code = await wait_promise(get_grant_code(token)),
            cred_response = await wait_promise(get_cred(grant_code));
        return cred_response;
    }

    /**
     * 执行签到
     * @param {object} cred_response Cred 请求获取内容
     */
    async function do_sign(cred_response) {
        let sign_token = cred_response['token'],
            cred = cred_response['cred'],
            characters = await wait_promise(get_binding_list(cred, sign_token));

        // 对各个角色进行签到
        for (let character of characters) {
            let body = {
                'gameId': character['channelMasterId'],
                'uid': character['uid']
            }
            let sign = await generate_signature(sign_token, sign_url, body);
            let append = {
                'sign': sign,
                'cred': cred
            };
            GM_xmlhttpRequest({
                method: 'POST',
                url: sign_url,
                headers: Object.assign(header_login, sign_header, append),
                data: JSON.stringify(body),
                responseType: 'json',
                onload: async (xhr) => {
                    if (xhr.response.code != 0) {
                        send_message(`角色${character['nickName']}(${character['channelName']})签到失败，原因：${xhr.response.message}`);
                    } else {
                        let awards = xhr.response.data.awards;
                        for (let item of awards) {
                            send_message(`角色${character['nickName']}(${character['channelName']})签到成功，获得了${item['resource']['name']}×${item['count'] || 1}。`);
                        }
                    }
                }
            });
        }
        resolve('ok');
    }

    /**
     * 获取绑定角色列表
     * @param {string} cred 鹰角账号凭证
     * @param {string} token 令牌
     * @returns 绑定角色列表
     */
    function get_binding_list(cred, token) {
        return new Promise(async (resolve, reject) => {
            let sign = await generate_signature(token, binding_url);
            let append = {
                'sign': sign,
                'cred': cred
            };
            GM_xmlhttpRequest({
                method: 'GET',
                url: binding_url,
                headers: Object.assign(header_login, sign_header, append),
                responseType: 'json',
                onload: async (xhr) => {
                    if (xhr.response.code == 0) {
                        for (let list of xhr.response.data.list) {
                            if (list['appCode'] == 'arknights') {
                                resolve(list['bindingList']);
                            }
                        }
                    } else {
                        reject('error');
                    }
                }
            });
        })
    }

    /**
     * 请求获取鹰角系统时间戳
     * @returns Timestamp
     */
    async function get_web_timestamp() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: binding_url,
                responseType: 'json',
                onload: (xhr) => {
                    resolve(xhr.response.timestamp);
                }
            });
        })
    }

    /**
     * Url 解析
     * @param {string} url 网址
     * @returns 返回地址和参数
     */
    function parseUrl(url) {
        let a = document.createElement('a');
        a.href = url;
        return {
            path: a.pathname.replace(/^([^\/])/, '/$1'),
            query: a.search.substring(1, a.search.length)
        }
    }

    /**
     * 生成签名
     * @param {string} token 令牌
     * @param {string} url 网址
     * @param {object} data Json 数据
     * @returns Sign Header
     */
    async function generate_signature(token, url, data = null) {
        let timestamp = await wait_promise(get_web_timestamp());
        sign_header.timestamp = timestamp;

        let s = `${parseUrl(url).path}${parseUrl(url).query}${data ? JSON.stringify(data) : ''}${timestamp}${JSON.stringify(sign_header)}`,
            hash = CryptoJS.HmacSHA256(s, token), // CryptoJS.HmacSHA256("Message", "Secret Passphrase")
            hex = CryptoJS.enc.Hex.stringify(hash),
            md5_hash = CryptoJS.MD5(hex),
            md5 = CryptoJS.enc.Hex.stringify(md5_hash)

        return md5;
    }

    /**
     * 发送通知消息
     * @param {string} text 消息文本
     */
    function send_message(text) {
        GM_notification({
            text: text,
            title: GM_info.script.name,
            image: GM_info.script.icon
        });
    }
})