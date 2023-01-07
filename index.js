// ==UserScript==
// @name         微博一键下载（9宫格&&视频）
// @namespace    https://github.com/wah0713/getWeiboImage
// @version      1.07
// @description  一个兴趣使然的脚本，微博一键下载脚本。
// @supportURL   https://github.com/wah0713/getWeiboImage/issues
// @updateURL    https://greasyfork.org/scripts/454816-%E5%BE%AE%E5%8D%9A%E4%B8%80%E9%94%AE%E5%8F%96%E5%9B%BE-9%E5%AE%AB%E6%A0%BC/code/%E5%BE%AE%E5%8D%9A%E4%B8%80%E9%94%AE%E5%8F%96%E5%9B%BE%EF%BC%889%E5%AE%AB%E6%A0%BC%EF%BC%89.user.js
// @author       wah0713
// @compatible   chrome
// @license      MIT
// @icon         https://weibo.com/favicon.ico
// @require      https://cdn.bootcss.com/jquery/1.12.4/jquery.min.js
// @require      https://cdn.bootcss.com/jszip/3.1.5/jszip.min.js
// @match        *://weibo.com/*
// @match        *://*.weibo.com/*
// @match        *://t.cn/*
// @connect      sinaimg.cn
// @connect      weibo.com
// @connect      weibocdn.com
// @connect      miaopai.com
// @connect      qq.com
// @connect      youku.com
// @connect      weibo.com
// @connect      cibntv.net
// @connect      *
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
    // 消息
    const message = {
        getReady: '准备中',
        isEmptyError: '失败，未找到资源',
        isUnkownError: '失败，未知错误',
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

        // title为空，即未初始化
        if (title === '') {
            return false
        }

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
            topMedia,
            pic_infos,
            created_at,
            user: {
                screen_name
            }
        } = await getInfoById(id)

        const date = new Date(created_at)
        const Y = date.getFullYear()
        const M = formatNumber(date.getMonth() + 1)
        const D = formatNumber(date.getDate())
        const H = formatNumber(date.getHours())
        const m = formatNumber(date.getMinutes())
        const time = `${Y}-${M}-${D} ${H}_${m}`

        const urlData = {};

        // 图片
        pic_infos && [...Object.keys(pic_infos)].forEach((ele, index) => {
            urlData[formatNumber(index + 1)] = pic_infos[ele].largest.url

            if (pic_infos[ele].type === 'livephoto') {
                urlData[`${formatNumber(index + 1)}_live`] = pic_infos[ele].video
            }
        })

        // 视频
        if (topMedia) {
            urlData.media = topMedia
        }

        return {
            urlData,
            time,
            userName: screen_name
        }
    }

    // 判断为空图片
    function isEmptyFile(res) {
        if (res.finalUrl.endsWith('gif#101')) {
            return true
        }
        return false
    }

    // 打包
    function pack(imageRes, modification) {
        const zip = new JSZip();
        imageRes.forEach(function (obj) {
            // 打包时过滤空文件
            if (isEmptyFile(obj)) return false

            const suffixName = new URL(obj.finalUrl).pathname.match(/\.(\w+)$/) && RegExp.$1
            const name = `${modification}-part${obj._name}.${suffixName}`
            zip.file(name, obj._blob);
        });
        return new Promise(async (resolve, rejcet) => {
            // 生成zip文件并下载
            resolve(await zip.generateAsync({
                type: 'blob'
            }))
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

    // 下载流
    function getFileBlob(url, _name, options) {
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
                    options.callback && options.callback()
                    resolve({
                        ...res,
                        _blob: res.response,
                        _name
                    })
                },
                onerror: (res) => {
                    isDebug && console.log(`getFileBlob-onerror`, res)
                    resolve(null)
                },
                onprogress: (res) => {
                    options.onprogress && options.onprogress(res)
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
                    const response = res.response
                    response.topMedia = ''
                    try {
                        // retweeted_status 为转发
                        if (res.response.retweeted_status) {
                            if (res.response.retweeted_status.page_info) {
                                response.topMedia = get(res.response.retweeted_status, 'page_info.media_info.playback_list[0].play_info.url', get(res.response.retweeted_status, 'page_info.media_info.stream_url', ''))
                            }
                            if (res.response.retweeted_status.pic_infos) {
                                response.pic_infos = res.response.retweeted_status.pic_infos
                            }
                        } else {
                            if (res.response.page_info) {
                                response.topMedia = get(res.response, 'page_info.media_info.playback_list[0].play_info.url', get(res.response, 'page_info.media_info.stream_url', ''))
                            }
                            if (res.response.pic_infos) {
                                response.pic_infos = res.response.pic_infos
                            }
                        }
                    } catch (error) {}
                    resolve(response)
                },
                onerror: (res) => {
                    isDebug && console.log(`getInfoById-onerror`, res)
                    resolve(null)
                }
            })
        })
    }

    // 下载视频
    async function DownLoadMedia(href, urlData) {
        const mediaRes = await getFileBlob(urlData.media, 'media', {
            onprogress: (res) => {
                const {
                    loaded,
                    totalSize
                } = res
                const completedQuantity = loaded
                const total = totalSize
                data[href].completedQuantity = completedQuantity
                data[href].total = total
                const percentage = completedQuantity / total * 100

                data[href].message = `中${formatNumber(completedQuantity / 1024/ 1024)}/${formatNumber(total / 1024/ 1024)}M（${formatNumber(percentage)}%）`
            }
        })
        let suffixName = new URL(urlData.media).pathname.match(/\.(\w+)$/) && RegExp.$1
        if (['json', null].includes(suffixName)) {
            suffixName = 'mp4'
        }

        if (mediaRes._blob) {
            download(URL.createObjectURL(mediaRes._blob), `${data[href].title}.${suffixName}`)
            return true
        }
        return false
    }

    // 下载图片（默认）
    async function DownLoadImage(href, urlData, urlArr) {
        const total = urlArr.length
        data[href].total = total
        const promiseList = urlArr.map((item) => getFileBlob(urlData[item], item, {
            callback: () => {
                data[href].completedQuantity++
                const completedQuantity = data[href].completedQuantity

                const percentage = new Intl.NumberFormat(undefined, {
                    maximumFractionDigits: 2
                }).format(completedQuantity / total * 100)
                data[href].message = `中${completedQuantity}/${total}（${percentage}%）`
            }
        }))
        const imageRes = await Promise.all(promiseList)

        const content = await pack(imageRes, data[href].title)
        download(URL.createObjectURL(content), `${data[href].title}.zip`)
        return true
    }

    // 数字格式化
    function formatNumber(number) {
        return String(new Intl.NumberFormat(undefined, {
            maximumFractionDigits: 2
        }).format(number)).padStart(2, '0')
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

    /**
     * object: 对象
     * path: 输入的路径
     * defaultVal: 默认值
     * url: https://blog.csdn.net/RedaTao/article/details/108119230
     **/
    function get(object, path, defaultVal = undefined) {
        // 先将path处理成统一格式
        let newPath = [];
        if (Array.isArray(path)) {
            newPath = path;
        } else {
            // 先将字符串中的'['、']'去除替换为'.'，split分割成数组形式
            newPath = path.replace(/\[/g, '.').replace(/\]/g, '').split('.');
        }

        // 递归处理，返回最后结果
        return newPath.reduce((o, k) => {
            return (o || {})[k]
        }, object) || defaultVal;
    }

    async function main(href, urlData) {
        const urlArr = Object.keys(urlData);
        if (urlArr.length <= 0) {
            // 没有资源
            data[href].message = message.isEmptyError
            return false
        }

        let = isSuccess = true
        if (urlArr.length === 1 && urlArr[0] === 'media') {
            // 下载视频
            isSuccess = await DownLoadMedia(href, urlData)
        } else {
            // 下载图片（默认）
            isSuccess = await DownLoadImage(href, urlData, urlArr)
        }
        if (isSuccess) {
            // 下载成功
            data[href].message = message.finish
        } else {
            // 下载失败
            data[href].message = message.isUnkownError
        }
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
        if (event.target.className !== event.currentTarget.className || ![message.isEmptyError, message.finish, undefined, ''].includes(gettextDom(this))) return false

        const href = $(this).find('.head-info_time_6sFQg').attr('href')

        data[href] = {
            urlData: {},
            title: '',
            name: href,
            total: 0,
            completedQuantity: 0,
            message: '',
        }

        const {
            urlData,
            time,
            userName
        } = await getfileUrlByInfo(this)

        data[href].title = `${userName} ${time}`
        data[href].urlData = urlData
        data[href].message = message.getReady

        main(href, urlData)
    })

    $('.showMessage').on('click', '.downloadBtn', async function (event) {
        if (event.target.className !== event.currentTarget.className || ![message.isEmptyError, message.finish, undefined, ''].includes(gettextDom(this))) return false
        const href = $(this).data('href')

        data[href].completedQuantity = 0
        data[href].message = message.getReady
        main(href, data[href].urlData)
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