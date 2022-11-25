// ==UserScript==
// @name         微博一键取图（9宫格）
// @namespace    https://github.com/wah0713/getWeiboImage
// @version      1.03
// @description  一个兴趣使然的脚本，微博一键取图脚本。
// @supportURL   https://github.com/wah0713/getWeiboImage/issues
// @updateURL    https://greasyfork.org/scripts/454816-%E5%BE%AE%E5%8D%9A%E4%B8%80%E9%94%AE%E5%8F%96%E5%9B%BE-9%E5%AE%AB%E6%A0%BC/code/%E5%BE%AE%E5%8D%9A%E4%B8%80%E9%94%AE%E5%8F%96%E5%9B%BE%EF%BC%889%E5%AE%AB%E6%A0%BC%EF%BC%89.user.js
// @author       wah0713
// @compatible   chrome
// @license      MIT
// @icon         https://weibo.com/favicon.ico
// @require      https://cdn.bootcss.com/jquery/1.12.4/jquery.min.js
// @require      https://cdn.bootcss.com/jszip/3.9.1/jszip.min.js
// @match        *://weibo.com/*
// @match        *://d.weibo.com/*
// @connect      sinaimg.cn
// @connect      weibo.com
// @noframes     true
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        unsafeWindow
// ==/UserScript==

(async function () {
    // 是否开启dubug模式
    let isDebug = false
    // 定时器集合
    const timerObject = {}
    // 消息
    const message = {
        getReady: '准备中',
        noImageError: '失败，未找到图片资源',
        finish: '完成'
    }
    const $frameContent = $('.woo-box-flex.Frame_content_3XrxZ')
    // 兼容旧版
    const $wbMiniblog = $('.WB_miniblog_fb')

    const data = new Proxy({}, {
        set(target, propKey, value, receiver) {
            const num = [...Object.keys(target)].length + 1
            retextDom($frameContent, `进行中的下载任务数：${num}`)
            retextDom($wbMiniblog, `进行中的下载任务数：${num}`)
            return Reflect.set(target, propKey, value, receiver);
        },
        deleteProperty(target, propKey) {
            const num = [...Object.keys(target)].length - 1
            if (num) {
                retextDom($frameContent, `进行中的下载任务数：${num}`)
                retextDom($wbMiniblog, `进行中的下载任务数：${num}`)
            } else {
                retextDom($frameContent, '')
                retextDom($wbMiniblog, '')
            }
            delete target[propKey];
            return true
        }
    })

    $('.Main_full_1dfQX').on('click', '.woo-box-flex .head-info_info_2AspQ:not(.Feed_retweetHeadInfo_Tl4Ld)', async function () {
        if (![message.noImageError, message.finish, undefined, ''].includes(gettextDom(this))) return false
        const href = $(this).find('.head-info_time_6sFQg').attr('href')

        data[href] = {
            num: 0
        }

        retextDom(this, message.getReady)
        const imgUrlList = await getfileUrlByInfo(this)
        if (imgUrlList.length <= 0) {
            // 没有资源
            retextDom(this, message.noImageError, href)
            delete data[href]
            return false
        }

        const promiseList = imgUrlList.map((item, index) => getFileBlob(item, index, () => {
            data[href].num++
            const total = imgUrlList.length
            const num = data[href].num

            const percentage = new Intl.NumberFormat(undefined, {
                maximumFractionDigits: 2
            }).format(num / total * 100)
            retextDom(this, `中${num}/ ${total}（${percentage}%）`)
        }))
        const imageRes = await Promise.all(promiseList)
        const writerName = $(this).prev().find('.head_name_24eEB').text().trim()
        const time = $(this).find('.head-info_time_6sFQg').attr('title').trim() || $(this).find('.head-info_time_6sFQg').text().trim()
        await pack(imageRes, `${writerName} ${time}`)
        // 下载成功
        retextDom(this, message.finish, href)
        delete data[href]

    })
    // 旧版(兼容代码 开始)
    if (!$('.Main_full_1dfQX').length) {
        $('body').on('click', '.WB_detail > .WB_from.S_txt2', async function () {
            if (![message.noImageError, message.finish, undefined, ''].includes(gettextDom(this))) return false
            const href = $(this).find('[node-type="feed_list_item_date"]').attr('href')

            data[href] = {
                num: 0
            }

            retextDom(this, message.getReady)
            const imgUrlList = await getfileUrlByInfo_old(this)
            if (imgUrlList.length <= 0) {
                // 没有资源
                retextDom(this, message.noImageError, href)
                delete data[href]
                return false
            }

            const promiseList = imgUrlList.map((item, index) => getFileBlob(item, index, () => {
                data[href].num++
                const total = imgUrlList.length
                const num = data[href].num

                const percentage = new Intl.NumberFormat(undefined, {
                    maximumFractionDigits: 2
                }).format(num / total * 100)
                retextDom(this, `中${num}/ ${total}（${percentage}%）`)
            }))
            const imageRes = await Promise.all(promiseList)
            const writerName = $(this).prev().find('.W_f14.W_fb.S_txt1').text().trim()
            const time = $(this).find('[node-type="feed_list_item_date"]').attr('title').trim() || $(this).find('[node-type="feed_list_item_date"]').text().trim()
            await pack(imageRes, `${writerName} ${time}`)
            // 下载成功
            retextDom(this, message.finish, href)
            delete data[href]
        })
    }
    // 获取图片链接
    async function getfileUrlByInfo_old(dom) {
        const idList = []
        $(dom).parents('.WB_detail').find('[node-type="feed_list_item_date"]').each((index, item) => {
            idList.push($(item).attr('href').replace(/\?.*$/, '').match(/(?<=\/)\w+$/)[0])
        })
        const resList = await Promise.all(idList.map(getInfoById))
        const urlList = []
        resList.forEach(item => {
            if (!item) return false;
            [...Object.keys(item)].forEach(ele => {
                urlList.push(item[ele].largest.url)
                if (item[ele].type === 'livephoto') {
                    urlList.push(item[ele].video)
                }
            })
        })
        return urlList
    }
    // 旧版(兼容代码 结束)

    // 打包
    function pack(imageRes, modification) {
        var zip = new JSZip();
        imageRes.forEach(function (obj) {
            const suffixName = new URL(obj.finalUrl).pathname.match(/\.\w+$/)[0]
            const name = `${modification}-part${String(obj._id).padStart(2,'0')}${suffixName}`
            zip.file(name, obj._blob);
        });
        return new Promise((resolve, rejcet) => {
            // 生成zip文件并下载
            zip.generateAsync({
                type: 'blob'
            }).then((content) => {
                GM_download({
                    url: URL.createObjectURL(content),
                    name: `${modification}.zip`,
                    onload: (res) => {
                        isDebug && console.log(`pack-onload`, res)
                        resolve(res)
                    },
                    onerror: (res) => {
                        isDebug && console.log(`pack-onerror`, res)
                        resolve(res)
                    }
                })
            })
        })
    }

    // 下载
    function getFileBlob(url, index, callback) {
        return new Promise((resolve, rejcet) => {
            GM_xmlhttpRequest({
                url,
                method: 'get',
                responseType: 'blob',
                headers: {
                    referer: 'https://weibo.com/',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
                },
                onload: (res) => {
                    isDebug && console.log(`getFileBlob-onload`, res)
                    callback()
                    resolve({
                        ...res,
                        _blob: res.response,
                        _id: index + 1
                    })
                },
                onerror: (res) => {
                    isDebug && console.log(`getFileBlob-onerror`, res)
                    resolve(null)
                }
            })
        })
    }

    // 通过id获取链接
    function getInfoById(id) {
        return new Promise((resolve, rejcet) => {
            GM_xmlhttpRequest({
                url: `https://weibo.com/ajax/statuses/show?id=${id}`,
                responseType: 'json',
                onload: (res) => {
                    isDebug && console.log(`getInfoById-onload`, res)
                    resolve(res.response.pic_infos)
                },
                onerror: (res) => {
                    isDebug && console.log(`getInfoById-onerror`, res)
                    resolve(null)
                }
            })
        })
    }

    // 获取图片链接
    async function getfileUrlByInfo(dom) {
        const idList = []
        $(dom).parents('.Feed_body_3R0rO').find('.head-info_time_6sFQg').each((index, item) => {
            idList.push($(item).attr('href').match(/(?<=\/)\w+$/)[0])
        })
        const resList = await Promise.all(idList.map(getInfoById))
        const urlList = []
        resList.forEach(item => {
            if (!item) return false;
            [...Object.keys(item)].forEach(ele => {
                urlList.push(item[ele].largest.url)
                if (item[ele].type === 'livephoto') {
                    urlList.push(item[ele].video)
                }
            })
        })
        return urlList
    }

    // dom修改文本
    function retextDom(dom, text, timer) {
        const $dom = $(dom)
        $dom.attr('show-text', text)
        if (timer) {
            timerObject[timer] && clearTimeout(timerObject[timer])
            timerObject[timer] = setTimeout(() => {
                $(`[href='${timer}']`).parent().attr('show-text', '')
            }, 2000)
        }
    }

    // 获取dom文本
    function gettextDom(dom) {
        return $(dom).attr('show-text')
    }

    function clickEscKey() {
        const evt = document.createEvent('UIEvents');
        Object.defineProperty(evt, 'keyCode', {
            get: function () {
                return this.keyCodeVal;
            }
        });
        Object.defineProperty(evt, 'which', {
            get: function () {
                return this.keyCodeVal;
            }
        });
        evt.keyCodeVal = 27;
        evt.initEvent('keydown', true, true);
        document.body.dispatchEvent(evt);
    }

    // 预览图片时，点击图片关闭预览功能
    $('.imgInstance.Viewer_imgElm_2JHWe').on('click', () => {
        clickEscKey()
    })

    GM_addStyle(`
    .WB_detail>.WB_from.S_txt2:after,.woo-box-flex .head-info_info_2AspQ:not(.Feed_retweetHeadInfo_Tl4Ld):after{content:"下载" attr(show-text);color:#ff8200;cursor:pointer}.WB_detail>.WB_from.S_txt2:after{float:right}.WB_miniblog_fb:before,.woo-box-flex.Frame_content_3XrxZ:before{content:attr(show-text);color:#d52c2b;position:fixed;left:0;width:4em}
    `)

    // debugJS
    isDebug = true
    unsafeWindow.$ = $
    setTimeout(() => {}, 5 * 1000);
})()