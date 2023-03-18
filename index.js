// ==UserScript==
// @name         微博一键下载（9宫格&&视频）
// @namespace    https://github.com/wah0713/getWeiboResources
// @version      1.7.2
// @description  一个兴趣使然的脚本，微博一键下载脚本。傻瓜式-简单、易用、可靠
// @supportURL   https://github.com/wah0713/getWeiboResources/issues
// @updateURL    https://greasyfork.org/scripts/454816/code/download.user.js
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
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// ==/UserScript==

(async function () {
    const $frameContent = $('.Frame_content_3XrxZ')
    const $mMain = $('.m-main')
    let $main = ''
    let $cardList = ''
    let cardHeadStr = ''
    let cardHeadAStr = ''
    if ($frameContent.length === 0 && $mMain.length) {
        // 搜索页面
        $main = $mMain
        $cardList = $('.main-full')
        cardHeadStr = 'div.card-feed  div.from'
        cardHeadAStr = 'a[suda-data]'
    } else if ($frameContent.length && $mMain.length === 0) {
        // 默认页面
        $main = $frameContent
        $cardList = $('.Main_full_1dfQX')
        cardHeadStr = '.head-info_info_2AspQ'
        cardHeadAStr = '.head-info_time_6sFQg'
    } else {
        return false
    }

    // 第一次使用
    let isFirst = GM_getValue('isFirst', true)
    // 是否开启dubug模式
    let isDebug = false
    let timer = null
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
            retextDom($(`${cardHeadStr}:has(>[href="${name}"])`), value)
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

        if (config.isShowActive.value) {
            notice.messagelist = notice.messagelist.filter(item => item.message !== '下载完成')
        }

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

        clearTimeout(timer)
        $('#wah0713').removeClass('out')
        if (config.isAutoHide.value && notice.completedQuantity === 0) {
            timer = setTimeout(() => {
                $('#wah0713').addClass('out')
            }, 5000)
        }
    }

    // 获取资源链接
    async function getfileUrlByInfo(dom) {
        const id = $(dom).children('a').attr('href').match(/(?<=\d+\/)(\w+)/) && RegExp.$1
        const {
            topMedia,
            pic_infos,
            mix_media_info,
            region_name,
            geo,
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
        const time = `${Y}-${M}-${D} ${H}:${m}`

        const urlData = {};

        // 图片
        pic_infos && [...Object.keys(pic_infos)].forEach((ele, index) => {
            urlData[formatNumber(index + 1)] = get(pic_infos[ele], 'largest.url', '')

            if (pic_infos[ele].type === 'livephoto') {
                urlData[`${formatNumber(index + 1)}_live`] = get(pic_infos[ele], 'video', '')
            }
        })

        // 图片加视频
        mix_media_info && mix_media_info.items.forEach((ele, index) => {
            let imgUrl = null
            let mediaUrl = null
            if (ele.type === "video") {
                imgUrl = get(ele, 'data.pic_info.pic_big.url', '')
                mediaUrl = get(ele, 'data.media_info.mp4_sd_url', '')
            } else {
                imgUrl = get(ele, 'data.largest.url', '')
            }

            urlData[formatNumber(index + 1)] = imgUrl
            if (mediaUrl) {
                urlData[`${formatNumber(index + 1)}_media`] = mediaUrl
            }
        })

        // 视频
        if (topMedia) {
            urlData.media = topMedia
        }

        return {
            urlData,
            time,
            geo,
            regionName: region_name,
            userName: screen_name,
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
        URL.revokeObjectURL(url)
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
                            response.pic_infos = res.response.retweeted_status.pic_infos
                            response.mix_media_info = res.response.retweeted_status.mix_media_info
                        }

                        // 视频
                        if (res.response.page_info) {
                            response.topMedia = get(res.response, 'page_info.media_info.playback_list[0].play_info.url', get(res.response, 'page_info.media_info.stream_url', ''))
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

    // 下载（默认）
    async function DownLoadDefault(href, urlData, urlArr) {
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

        const content = await pack(imageRes.filter(item => !isEmptyFile(item)), data[href].title)
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
        $(dom).attr('show-text', text)
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

        let isSuccess = true
        if (urlArr.length === 1 && urlArr[0] === 'media') {
            // 下载视频
            isSuccess = await DownLoadMedia(href, urlData)
        } else {
            // 下载（默认）
            isSuccess = await DownLoadDefault(href, urlData, urlArr)
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

    $main.prepend(`
        <div id="wah0713">
            <div class="container">
                <div class="showMessage"></div>
                <div class="input-box">需要显示的消息条数：<input type="number" max="${max}" min="${min}" value="${messagesNumber}" step=1>
                </div>
            </div>
        </div>
       `)

    // 是第一次使用开启
    if (isFirst) {
        $cardList.addClass('isFirst')
    }

    $cardList.on('click', `${cardHeadStr}:not(.Feed_retweetHeadInfo_Tl4Ld)`, async function (event) {
        if (event.target.className !== event.currentTarget.className || ![message.isEmptyError, message.finish, undefined, ''].includes(gettextDom(this))) return false

        // 关闭第一次使用提示
        if (isFirst) {
            isFirst = false
            GM_setValue('isFirst', false)
            $cardList.removeClass('isFirst')
        }

        const href = $(this).find(cardHeadAStr).attr('href')

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
            userName,
            regionName,
            geo,
        } = await getfileUrlByInfo(this)

        let title = `${userName}_${time}`.replace(/\s/g, '_')
        // 是否下载名中显示IP区域
        if (regionName && config.isShowRegion.value) {
            const region = regionName.match(/\s(.*)/) && RegExp.$1
            if (region) {
                title += '_' + region
            }
        }

        // 下载名中显示定位
        const geoName = get(geo, 'detail.title', null)
        if (geoName && config.isShowGeo.value) {
            title += '_' + geoName
        }

        data[href].title = title
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
        $(cardHeadStr).attr('show-text', '');
        requestAnimationFrame(() => {
            [...Object.keys(data)].forEach(item => {
                const {
                    message,
                } = data[item]
                retextDom($(`${cardHeadStr}:has(>[href="${item}"])`), message)
            })
        })
    });
    observer.observe($main[0], {
        childList: true,
        subtree: true
    });

    const config = {
        isShowRegion: {
            name: '下载名中显示IP区域',
            id: null,
            value: GM_getValue('isShowRegion', false)
        },
        isShowGeo: {
            name: '下载名中显示定位',
            id: null,
            value: GM_getValue('isShowGeo', false)
        },
        isAutoHide: {
            name: '左侧消息自动消失',
            id: null,
            value: GM_getValue('isAutoHide', false)
        },
        isShowActive: {
            name: '左侧消息过滤【已经完成】',
            id: null,
            value: GM_getValue('isShowActive', false)
        }
    }

    function updateMenuCommand() {
        [...Object.keys(config)].forEach(item => {
            const {
                id,
                value,
                name
            } = config[item]
            if (id) {
                GM_unregisterMenuCommand(id)
            }
            config[item].id = GM_registerMenuCommand(`${value?'✔️':'❌'}${name}`, () => {
                GM_setValue(item, !value)
                config[item].value = !value
                updateMenuCommand()
            })
        })
    }
    updateMenuCommand()

    GM_addStyle(`
   body{--yellow:#ff8200}.head-info_info_2AspQ:not(.Feed_retweetHeadInfo_Tl4Ld):after,div.card-feed div.from:after{content:"下载" attr(show-text);color:var(--yellow);cursor:pointer;float:right}.main-full.isFirst div.card-feed div.from:after,.Main_full_1dfQX.isFirst .head-info_info_2AspQ:not(.Feed_retweetHeadInfo_Tl4Ld):after{animation:wobble 1s infinite alternate}@keyframes wobble{0%{-webkit-transform:translateZ(0);transform:translateZ(0)}15%{-webkit-transform:translate3d(-25%,0,0) rotate(-5deg);transform:translate3d(-25%,0,0) rotate(-5deg)}30%{-webkit-transform:translate3d(20%,0,0) rotate(3deg);transform:translate3d(20%,0,0) rotate(3deg)}45%{-webkit-transform:translate3d(-15%,0,0) rotate(-3deg);transform:translate3d(-15%,0,0) rotate(-3deg)}60%{-webkit-transform:translate3d(10%,0,0) rotate(2deg);transform:translate3d(10%,0,0) rotate(2deg)}75%{-webkit-transform:translate3d(-5%,0,0) rotate(-1deg);transform:translate3d(-5%,0,0) rotate(-1deg)}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}.Frame_content_3XrxZ #wah0713,.m-main #wah0713{font-size:12px;font-weight:700}.Frame_content_3XrxZ #wah0713.out,.m-main #wah0713.out{opacity:0}.Frame_content_3XrxZ #wah0713.out:hover,.m-main #wah0713.out:hover{opacity:1}.Frame_content_3XrxZ #wah0713 .container,.m-main #wah0713 .container{position:fixed;left:0;z-index:1}.Frame_content_3XrxZ #wah0713:hover .input-box,.m-main #wah0713:hover .input-box{display:block}.Frame_content_3XrxZ #wah0713 input,.m-main #wah0713 input{width:3em;color:var(--yellow);border-width:1px;outline:0;background-color:transparent}.Frame_content_3XrxZ #wah0713 .input-box,.m-main #wah0713 .input-box{display:none}.Frame_content_3XrxZ #wah0713 .showMessage>p,.m-main #wah0713 .showMessage>p{line-height:16px;margin:4px}.Frame_content_3XrxZ #wah0713 .showMessage>p span,.m-main #wah0713 .showMessage>p span{color:#333}.Frame_content_3XrxZ #wah0713 .showMessage>p span.red,.m-main #wah0713 .showMessage>p span.red{color:var(--yellow)}.Frame_content_3XrxZ #wah0713 .showMessage>p span.red.downloadBtn,.m-main #wah0713 .showMessage>p span.red.downloadBtn{cursor:pointer}
    `)

    // // debugJS
    // isDebug = true
    // unsafeWindow.$ = $
})()