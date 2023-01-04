// ==UserScript==
// @name         微博一键取图（9宫格）
// @namespace    https://github.com/wah0713/getWeiboImage
// @version      1.06
// @description  一个兴趣使然的脚本，微博一键取图脚本。
// @supportURL   https://github.com/wah0713/getWeiboImage/issues
// @updateURL    https://greasyfork.org/scripts/454816-%E5%BE%AE%E5%8D%9A%E4%B8%80%E9%94%AE%E5%8F%96%E5%9B%BE-9%E5%AE%AB%E6%A0%BC/code/%E5%BE%AE%E5%8D%9A%E4%B8%80%E9%94%AE%E5%8F%96%E5%9B%BE%EF%BC%889%E5%AE%AB%E6%A0%BC%EF%BC%89.user.js
// @author       wah0713
// @compatible   chrome
// @license      MIT
// @icon         https://weibo.com/favicon.ico
// @require      https://cdn.bootcss.com/jquery/1.12.4/jquery.min.js
// @require      https://cdn.bootcss.com/jszip/3.1.5/jszip.min.js
// @require      https://cdn.bootcss.com/dayjs/1.11.7/dayjs.min.js
// @match        *://weibo.com/*
// @match        *://*.weibo.com/*
// @match        *://t.cn/*
// @connect      sinaimg.cn
// @connect      weibo.com
// @noframes     true
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// ==/UserScript==

(async function () {
    const $frameContent = $('.woo-box-flex.Frame_content_3XrxZ')

    if ($frameContent.length === 0) return false

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
    // 左边显示的消息数
    let messagesNumber = GM_getValue('messagesNumber', 5)
    const max = 40
    const min = 3

    // 左侧通知
    const notice = {
        completedQuantity: 0,
        messagelist: []
    }

    // 递归proxy
    function reactive(data, callBack) {
        return new Proxy(data, {
            set(target, propKey, value, receiver) {
                callBack && callBack(target, propKey, value, receiver)
                if (typeof value === 'object') {
                    value = reactive(value, callBack)
                }
                return Reflect.set(target, propKey, value, receiver)
            }
        })
    }

    const data = reactive({}, (target, propKey, value, receiver) => {
        const {
            name,
        } = target
        if (propKey === 'message') {
            // 数据变化更新消息
            retextDom($(`.head-info_info_2AspQ:has(>[href="${name}"])`), value)
            handleMessage(target, value)
        }
    })

    function handleMessage(target, value) {
        const {
            name,
            title
        } = target
        const list = [...Object.keys(data)]
        notice.completedQuantity = list.length;
        list.forEach(item => {
            let {
                completedQuantity,
                total,
            } = data[item]

            if (completedQuantity === total) {
                notice.completedQuantity--
            }
        })

        notice.messagelist = notice.messagelist.filter(item => item.title !== title).slice(-(messagesNumber - 1))
        notice.messagelist.push({
            href: name,
            title,
            message: `下载${value}`
        })

        const tempList = JSON.parse(JSON.stringify(notice.messagelist))

        $('#wah0713 .container .showMessage').html(`
            <p><span>进行中的下载任务数：</span><span class="red">${notice.completedQuantity}</span></p>
            ${tempList.reverse().map(item=>{
                return `<p><span>${item.title}：</span><span data-href=${item.href} class="red downloadBtn">${item.message}</span></p>`
            }).join('')}
        `)
    }

    // 获取图片链接
    async function getfileUrlByInfo(dom) {
        const id = $(dom).children('a').attr('href').match(/(?<=\/)(\w+$)/) && RegExp.$1
        const {
            pic_infos,
            created_at,
            user: {
                screen_name
            }
        } = await getInfoById(id)
        const time = dayjs(created_at).format('YYYY-MM-DD HH_mm')
        const urlList = [];
        [...Object.keys(pic_infos)].forEach(ele => {
            urlList.push(pic_infos[ele].largest.url)
            if (pic_infos[ele].type === 'livephoto') {
                urlList.push(pic_infos[ele].video)
            }
        })
        return {
            urlList,
            time,
            userName: screen_name
        }
    }

    // 打包
    function pack(imageRes, modification) {
        const zip = new JSZip();
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
                download(URL.createObjectURL(content), `${modification}.zip`)
                resolve(true)
            })
        })
    }

    // 模拟点击下载
    function download(url, fileName) {
        const a = document.createElement('a')
        a.setAttribute('href', url)
        a.setAttribute('download', fileName)
        a.click()
        a.remove()
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
                    try {
                        const response = res.response
                        // retweeted_status 为转发
                        if (res.response.retweeted_status) {
                            response.pic_infos = res.response.retweeted_status.pic_infos
                        }

                        resolve(response)
                    } catch (error) {
                        resolve(null)
                    }
                },
                onerror: (res) => {
                    isDebug && console.log(`getInfoById-onerror`, res)
                    resolve(null)
                }
            })
        })
    }


    async function main(href, urlList) {

        if (urlList.length <= 0) {
            // 没有资源
            data[href].message = message.noImageError
            return false
        }

        const promiseList = urlList.map((item, index) => getFileBlob(item, index, () => {
            data[href].completedQuantity++
            const total = urlList.length
            const completedQuantity = data[href].completedQuantity

            const percentage = new Intl.NumberFormat(undefined, {
                maximumFractionDigits: 2
            }).format(completedQuantity / total * 100)
            data[href].total = total
            data[href].message = `中${completedQuantity}/${total}（${percentage}%）`
        }))
        const imageRes = await Promise.all(promiseList)

        await pack(imageRes, data[href].title)
        // 下载成功
        data[href].message = message.finish
    }

    // dom修改文本
    function retextDom(dom, text) {
        const $dom = $(dom)
        $dom.attr('show-text', text)
    }

    // 获取dom文本
    function gettextDom(dom) {
        return $(dom).attr('show-text')
    }

    // 模拟esc
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
    $('.imgInstance.Viewer_imgElm_2JHWe').on('click', clickEscKey)

    $frameContent.prepend(`
        <div id="wah0713">
            <div class="container">
                <div class="showMessage"></div>
                <div class="input-box">需要显示的消息条数：<input type="number" max="${max}" min="${min}" value="${messagesNumber}" step=1>
                </div>
            </div>
        </div>
       `)

    $('.Main_full_1dfQX').on('click', '.woo-box-flex .head-info_info_2AspQ:not(.Feed_retweetHeadInfo_Tl4Ld)', async function (event) {
        if (event.target.className !== event.currentTarget.className || ![message.noImageError, message.finish, undefined, ''].includes(gettextDom(this))) return false

        const href = $(this).find('.head-info_time_6sFQg').attr('href')
        const {
            urlList,
            time,
            userName
        } = await getfileUrlByInfo(this)

        data[href] = {
            urlList,
            title: `${userName} ${time}`,
            name: href,
            total: 0,
            completedQuantity: 0,
            message: message.getReady,
        }

        main(href, urlList)
    })

    $('.showMessage').on('click', '.downloadBtn', async function (event) {
        if (event.target.className !== event.currentTarget.className || ![message.noImageError, message.finish, undefined, ''].includes(gettextDom(this))) return false
        const href = $(this).data('href')

        data[href].completedQuantity = 0
        data[href].message = message.getReady
        main(href, data[href].urlList)
    })

    $('#wah0713 .container .input-box input').change(event => {
        event.target.value = event.target.value | 0
        if (event.target.value > max) {
            event.target.value = max
        }
        if (event.target.value < min) {
            event.target.value = min
        }
        messagesNumber = event.target.value
        GM_setValue('messagesNumber', messagesNumber)
    })

    const observer = new MutationObserver(() => {
        $(`.head-info_info_2AspQ`).attr('show-text', '');
        requestAnimationFrame(() => {
            [...Object.keys(data)].forEach(item => {
                const {
                    message,
                } = data[item]
                retextDom($(`.head-info_info_2AspQ:has(>[href="${item}"])`), message)
            })
        })
    });
    observer.observe($frameContent[0], {
        childList: true,
        subtree: true
    });

    GM_addStyle(`
    .woo-box-flex .head-info_info_2AspQ:not(.Feed_retweetHeadInfo_Tl4Ld):after{content:"下载" attr(show-text);color:#ff8200;cursor:pointer}.woo-box-flex.Frame_content_3XrxZ #wah0713{font-size:12px;font-weight:700}.woo-box-flex.Frame_content_3XrxZ #wah0713 .container{position:fixed;left:0}.woo-box-flex.Frame_content_3XrxZ #wah0713:hover .input-box{display:block}.woo-box-flex.Frame_content_3XrxZ #wah0713 input{width:3em;color:#d52c2b;border-width:1px;outline:0;background-color:transparent}.woo-box-flex.Frame_content_3XrxZ #wah0713 .input-box{display:none}.woo-box-flex.Frame_content_3XrxZ #wah0713 .showMessage>p{line-height:16px;margin:4px}.woo-box-flex.Frame_content_3XrxZ #wah0713 .showMessage>p span{color:#333}.woo-box-flex.Frame_content_3XrxZ #wah0713 .showMessage>p span.red{color:#d52c2b}.woo-box-flex.Frame_content_3XrxZ #wah0713 .showMessage>p span.red.downloadBtn{cursor:pointer}
    `)

    // // debugJS
    // isDebug = true
    // unsafeWindow.$ = $
    // setTimeout(() => {}, 5 * 1000);
})()