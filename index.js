// ==UserScript==
// @name         微博一键下载（9宫格&&视频）
// @namespace    https://github.com/wah0713/getWeiboResources
// @version      2.0.0
// @description  一个兴趣使然的脚本，微博一键下载脚本。傻瓜式-简单、易用、可靠
// @supportURL   https://github.com/wah0713/getWeiboResources/issues
// @updateURL    https://greasyfork.org/scripts/454816/code/download.user.js
// @author       wah0713
// @compatible   chrome
// @license      MIT
// @icon         https://weibo.com/favicon.ico
// @require      https://cdn.bootcss.com/jquery/1.12.4/jquery.min.js
// @require      https://cdn.bootcss.com/jszip/3.1.5/jszip.min.js
// @require      https://cdn.bootcdn.net/ajax/libs/m3u8-parser/6.0.0/m3u8-parser.min.js
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
// @connect      data.video.iqiyi.com
// @connect      cache.m.iqiyi.com
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
        // todo 说不定以后想做直播资源下载
        isLiveError: '失败，直播资源解析失败',
        isUnkownError: '失败，未知错误(点击重试)',
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

    const nameAll = {
        userName: '用户名',
        userID: '用户ID',
        time: '时间',
        geoName: '定位',
        region: 'IP区域',
        text: '微博文本',
    }
    let nameArr = GM_getValue('nameArr', ['userName', 'time'])

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
                return `<p><a href="${item.href}" target="_blank" title="打开微博详情">${item.title}：</a><span data-href=${item.href} class="red downloadBtn" title="点击再次下载">${item.message}</span></p>`
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
    async function getFileUrlByInfo(dom) {
        const id = $(dom).children('a').attr('href').match(/(?<=\d+\/)(\w+)/) && RegExp.$1
        const {
            isLive,
            topMedia,
            pic_infos,
            mix_media_info,
            text_raw,
            isLongText,
            region_name,
            geo,
            created_at,
            mblog_vip_type,
            user: {
                screen_name,
                idstr
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
        if (pic_infos) {
            const arr = [...Object.keys(pic_infos)]
            arr.forEach((ele, index) => {
                const afterName = arr.length === 1 ? '' : `-part${formatNumber(index + 1)}`

                // 超高清图源
                let url = `https://weibo.com/ajax/common/download?pid=${ele}`
                // 高清图源
                const mw2000Url = get(pic_infos[ele], 'mw2000.url', '')

                // 粉丝专属
                if (mblog_vip_type === 1) {
                    url = mw2000Url
                }

                urlData[`${afterName}.${getSuffixName(mw2000Url)}`] = url

                if (pic_infos[ele].type === 'livephoto') {
                    const url = get(pic_infos[ele], 'video', '')
                    urlData[`${afterName}.${getSuffixName(url)}`] = url
                }
            })
        }

        // 图片加视频
        if (mix_media_info) {
            mix_media_info.items.forEach((ele, index) => {
                const afterName = mix_media_info.items.length === 1 ? '' : `-part${formatNumber(index + 1)}`

                let imgUrl = null
                let mediaUrl = null
                if (ele.type === "video") {
                    imgUrl = get(ele, 'data.pic_info.pic_big.url', '')
                    mediaUrl = get(ele, 'data.media_info.mp4_sd_url', '')
                } else {
                    imgUrl = get(ele, 'data.mw2000.url', '')
                }

                urlData[`${afterName}.${getSuffixName(imgUrl)}`] = `https://weibo.com/ajax/common/download?pid=${imgUrl.match(/([\w]+)(?=\.\w+$)/)&& RegExp.$1}`

                if (mediaUrl) {
                    urlData[`${afterName}.${getSuffixName(mediaUrl)}`] = mediaUrl
                }
            })
        }

        // 视频
        if (topMedia) {
            urlData.media = topMedia
        }

        return {
            isLive,
            urlData,
            time,
            geo,
            isLongText,
            text: text_raw,
            regionName: region_name,
            userName: screen_name,
            userID: idstr,
        }
    }

    // 判断为空图片
    function isEmptyFile(res) {
        const size = get(res, '_blob.size', 0)
        const finalUrl = get(res, 'finalUrl', '')
        if (finalUrl.endsWith('gif#101') || size <= 200) {
            return true
        }
        return false
    }

    // 获取后缀
    function getSuffixName(url) {
        let suffixName = new URL(url).pathname.match(/\.(\w+)$/) && RegExp.$1
        if (['json', null].includes(suffixName)) {
            suffixName = 'mp4'
        }
        return suffixName
    }

    // 处理名称
    function getFileName({
        time,
        userName,
        userID,
        regionName,
        geo,
        text,
    }) {

        const region = regionName && regionName.match(/\s(.*)/) && RegExp.$1 || ''
        const geoName = get(geo, 'detail.title', '')
        const nameObj = {
            time,
            userName,
            userID,
            region,
            geoName,
            text,
        }

        let title = ''
        for (let i = 0; i < nameArr.length; i++) {
            const item = nameArr[i];
            if (nameObj[item]) {
                title += ` ${nameObj[item]}`
            }
        }
        title = title.trim()
        // 替换下载名中【特殊符号】为下划线【_】
        if (config.isSpecialHandlingName.value) {
            title = title.replace(/[\<|\>|\\|\/|;|:|\*|\?|\$|@|\&|\(|\)|\"|\'|#|\|]/g, '_')
        }
        return title
    }

    // 打包
    function pack(resBlob, modification) {
        const zip = new JSZip();
        resBlob.forEach(function (obj) {
            const name = `${modification}${obj._lastName}`
            zip.file(name, obj._blob);
        });
        return new Promise(async (resolve, reject) => {
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
        // 释放URL
        URL.revokeObjectURL(url)
    }

    // 下载流（文本）
    async function getTextBlob({
        text,
        href,
        isLongText
    }) {
        let content = text;
        if (isLongText) {
            content = await getLongtextById(href.match(/(?<=\d+\/)(\w+)/) && RegExp.$1) || text
        }

        const _blob = new Blob([content], {
            type: "text/plain;charset=utf-8",
        });

        return {
            _blob,
            _lastName: '.txt',
            finalUrl: 'https://github.com/wah0713/text.txt'
        }
    }

    // 下载流
    function getFileBlob(url, _lastName, options) {
        return new Promise((resolve, reject) => {
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

                    // 下载失败，也会正常返回空文件
                    const {
                        size,
                        type
                    } = res.response;
                    if (size <= 200 && type === "text/html; charset=utf-8") {
                        resolve(null)
                    }

                    resolve({
                        ...res,
                        _blob: res.response,
                        _lastName
                    })
                },
                onerror: (res) => {
                    console.error(`getFileBlob-onerror`, res)
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
        return new Promise((resolve, reject) => {
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
                            const {
                                isLive,
                                url
                            } = handleMedia(res)

                            response.topMedia = url
                            // 直播资源
                            response.isLive = isLive
                        }
                    } catch (error) {}
                    resolve(response)
                },
                onerror: (res) => {
                    console.error(`getInfoById-onerror`, res)
                    resolve(null)
                }
            })
        })
    }

    // 视频资源解析
    function handleMedia(res) {
        const objectType = get(res.response, 'page_info.object_type', '')
        const url = get(res.response, 'page_info.media_info.playback_list[0].play_info.url', get(res.response, 'page_info.media_info.stream_url', ''))
        return {
            isLive: objectType === 'live',
            url
        }
    }

    function blobToText(blob) {
        return new Promise((resolve, reject) => {
            // 将blob转为text
            let reader = new FileReader()
            reader.readAsText(blob, "utf-8")
            reader.addEventListener("loadend", () => {
                // text格式
                resolve(reader.result)
            })
        })
    }

    // 通过id获取长文
    function getLongtextById(id) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                url: `https://weibo.com/ajax/statuses/longtext?id=${id}`,
                responseType: 'json',
                onload: (res) => {
                    isDebug && console.log(`getLongtextById-onload`, res)
                    const response = res.response
                    resolve(response.data.longTextContent)
                },
                onerror: (res) => {
                    console.error(`getLongtextById-onerror`, res)
                    resolve(null)
                }
            })
        })
    }

    // 作者： 沐秋Alron
    // 链接： https://juejin.cn/post/7099344493010223134
    class TaskQueue {
        constructor(num = 10) {
            this.originMax = num; // 原始最大并发数
            this.max = this.originMax; // 最大并发数
            this.index = 0 // 下标
            this.taskList = [] // 用shift方法实现先进先出
            this.resList = [] // 最后返回队列数组
            this.isError = false // 任务失败
        }

        addTask(task) {
            this.taskList.push({
                task,
                index: this.index++
            });
        }

        async start() {
            return await this.run()
        }

        run() {
            return new Promise((resolve, reject) => {
                const length = this.taskList.length;
                if (!length) {
                    return false;
                }
                // 控制并发数量
                const min = Math.min(length, this.max);
                for (let i = 0; i < min; i++) {
                    // 开始占用一个任务的空间
                    this.max--;
                    const {
                        task,
                        index
                    } = this.taskList.shift();

                    task.then((res) => {
                        if (res === null) {
                            // 任意一个失败
                            this.isError = true
                            resolve(false)
                        }
                        this.resList[index] = res
                    }).finally(async () => {
                        // 任务完成，释放空间
                        this.max++;

                        if (this.isError) return false

                        if (this.max === this.originMax) {
                            // 任务完成
                            resolve(this.resList)
                        }
                        // 自动进行下一个任务
                        resolve(await this.run())
                    })
                }
            })
        }
    }

    // 下载视频
    async function DownLoadMedia({
        href,
        urlData,
        text,
        isLongText
    }) {
        const mediaRes = await getFileBlob(urlData.media, `.${getSuffixName(urlData.media)}`, {
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
        if (!get(mediaRes, '_blob', null)) {
            return false
        }

        if (!get(mediaRes, '_blob.type', '').startsWith('video')) {
            const parser = new m3u8Parser.Parser();
            parser.push(await blobToText(mediaRes._blob));
            parser.end();

            const urlArr = parser.manifest.segments.map(item => {
                let url
                try {
                    new URL(item.uri)
                    url = item.uri
                } catch (error) {
                    url = `${new URL(urlData.media).origin}/${item.uri}`
                }
                return url
            });

            data[href].completedQuantity = 0
            const total = urlArr.length

            const taskQueue = new TaskQueue();
            urlArr.forEach(item =>
                taskQueue.addTask(getFileBlob(item, '', {
                    callback: () => {
                        data[href].completedQuantity++
                        const completedQuantity = data[href].completedQuantity

                        const percentage = new Intl.NumberFormat(undefined, {
                            maximumFractionDigits: 2
                        }).format(completedQuantity / total * 100)
                        data[href].message = `中${completedQuantity}/${total}（${percentage}%）`
                    }
                }))
            )

            const taskQueueRes = await taskQueue.start()
            if (taskQueueRes === false) {
                // 解析失败
                return false
            }

            mediaRes._blob = new Blob(taskQueueRes.map(item => item._blob), {
                type: 'video/MP2T'
            })
            mediaRes._lastName = '.mp4'
        }

        if (text) {
            const content = await pack([mediaRes, await getTextBlob({
                text,
                href,
                isLongText
            })], data[href].title)

            download(URL.createObjectURL(content), `${data[href].title}.zip`)
        } else {
            download(URL.createObjectURL(mediaRes._blob), `${data[href].title}${mediaRes._lastName}`)
        }
        return true
    }

    // 下载（默认）
    async function DownLoadDefault({
        href,
        urlData,
        urlArr,
        text = '',
        isLongText
    }) {
        const total = urlArr.length
        data[href].total = total

        const taskQueue = new TaskQueue(3);
        urlArr.forEach(item =>
            taskQueue.addTask(getFileBlob(urlData[item], item, {
                callback: () => {
                    data[href].completedQuantity++
                    const completedQuantity = data[href].completedQuantity

                    const percentage = new Intl.NumberFormat(undefined, {
                        maximumFractionDigits: 2
                    }).format(completedQuantity / total * 100)
                    data[href].message = `中${completedQuantity}/${total}（${percentage}%）`
                }
            }))
        )

        let taskQueueRes = await taskQueue.start()
        if (taskQueueRes === false) {
            // 解析失败
            return false
        }

        if (text) {
            taskQueueRes.push(await getTextBlob({
                text,
                href,
                isLongText
            }))
        }

        taskQueueRes = taskQueueRes.filter(item => !isEmptyFile(item));

        if (taskQueueRes.length === 0) {
            return null
        } else if (taskQueueRes.length === 1) {
            download(URL.createObjectURL(taskQueueRes[0]._blob), `${data[href].title}${taskQueueRes[0]._lastName}`)
        } else if (taskQueueRes.length > 1) {
            const content = await pack(taskQueueRes, data[href].title)
            download(URL.createObjectURL(content), `${data[href].title}.zip`)
        }
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

    async function main({
        href,
        urlData,
        text,
        isLongText
    }) {

        if (data[href].isLive) {
            data[href].message = message.isLiveError
            return false
        }

        const urlArr = Object.keys(urlData);
        if (urlArr.length <= 0) {
            // 没有资源
            data[href].message = message.isEmptyError
            return false
        }

        let isSuccess = true

        if (!config.isIncludesText.value) {
            text = ''
        }

        if (urlArr.length === 1 && urlArr[0] === 'media') {
            // 下载视频
            isSuccess = await DownLoadMedia({
                href,
                urlData,
                text,
                isLongText
            })
        } else {
            // 下载（默认）
            isSuccess = await DownLoadDefault({
                href,
                urlData,
                urlArr,
                text,
                isLongText
            })
        }

        if (isSuccess === null) {
            // 没有资源
            data[href].message = message.isEmptyError
        } else if (isSuccess) {
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
            <div class="editName">
                <span>可选下载名（【点击】或【拖拽到下方】）</span>
                <ul class="unactive">
                    ${[...Object.keys(nameAll)].filter(item=>!nameArr.includes(item)).map(item=>{
                        return `<li data-id="${item}" draggable="true">${nameAll[item]}</li>`
                    }).join('')}
                </ul>
                <span>当前下载名（【用户名】为必选）</span>
                <ul class="active">
                    ${nameArr.map(item=>{
                        return `<li data-id="${item}" draggable="true">${nameAll[item]}</li>`
                    }).join('')}
                </ul>
            </div>
            <div class="input-box">需要显示的消息条数：<input type="number" max="${max}" min="${min}" value="${messagesNumber}"
                    step=1>
            </div>
        </div>
    </div>
       `)

    let dragstartDom = null;

    function updateNameArr() {
        nameArr = []
        dragstartDom = null;
        [...document.querySelector(`#wah0713 .editName ul.active`).children].forEach(item => {
            nameArr.push(item.dataset.id)
        })
        GM_setValue('nameArr', nameArr)
    }

    [...document.querySelectorAll('#wah0713 .editName ul')].forEach(item => {

        item.addEventListener('dragstart', function (event) {
            if (event.target.nodeName !== 'LI') {
                return false
            }
            dragstartDom = event.target
        });

        item.addEventListener('dragleave', function (event) {
            event.target.classList.remove('outline')
        });

        item.addEventListener('dragover', function (event) {
            if (item.classList.contains('unactive') && dragstartDom.dataset.id === 'userName') {
                event.dataTransfer.dropEffect = 'none';
                return false
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            event.target.classList.add('outline')
        });

        item.addEventListener('drop', function (event) {
            event.target.classList.remove('outline')
            if (event.target.nodeName === 'LI') {
                event.target.insertAdjacentElement("beforeBegin", dragstartDom)
            } else if (event.target.nodeName === 'UL') {
                event.target.insertAdjacentElement("beforeEnd", dragstartDom)
            }
            updateNameArr()
        });

        item.addEventListener('click', function (event) {
            if (event.target.nodeName !== 'LI' || event.target.dataset.id === 'userName') {
                return false
            }
            const className = item.classList.contains('unactive') ? 'active' : 'unactive'
            document.querySelector(`#wah0713 .editName ul.${className}`).insertAdjacentElement("beforeEnd", event.target)
            updateNameArr()
        })
    })

    // 是第一次使用开启
    if (isFirst) {
        $cardList.addClass('isFirst')
    }

    $cardList.on('click', `${cardHeadStr}:not(.Feed_retweetHeadInfo_Tl4Ld)`, async function (event) {
        if (event.target.className !== event.currentTarget.className || ![...Object.values(message).filter(item => item !== message.getReady), undefined, ''].includes(
                $(this).attr('show-text')
            )) return false

        // 关闭第一次使用提示
        if (isFirst) {
            isFirst = false
            GM_setValue('isFirst', false)
            $cardList.removeClass('isFirst')
        }

        const href = $(this).find(cardHeadAStr).attr('href')

        data[href] = {
            urlData: {},
            text: '',
            isLive: false, // 直播资源
            isLongText: false,
            title: '',
            name: href,
            total: 0,
            completedQuantity: 0,
            message: '',
        }

        const {
            urlData,
            isLive,
            time,
            userName,
            userID,
            regionName,
            geo,
            text,
            isLongText,
        } = await getFileUrlByInfo(this)

        data[href].title = getFileName({
            time,
            userName,
            userID,
            regionName,
            geo,
            text
        })
        data[href].urlData = urlData
        data[href].text = text
        data[href].isLongText = isLongText
        data[href].message = message.getReady
        data[href].isLive = isLive

        main({
            href,
            urlData,
            text,
            isLongText
        })
    })

    $('.showMessage').on('click', '.downloadBtn', async function (event) {
        if (event.target.className !== event.currentTarget.className || ![...Object.values(message).filter(item => item !== message.getReady), undefined, ''].includes($(this).text().replace(/^下载/, ''))) return false
        const href = $(this).data('href')

        data[href].completedQuantity = 0
        data[href].message = message.getReady

        main({
            href,
            urlData: data[href].urlData,
            text: data[href].text,
            isLongText: data[href].isLongText,
        })
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
        isSpecialHandlingName: {
            name: '替换下载名中【特殊符号】为下划线【_】',
            id: null,
            value: GM_getValue('isSpecialHandlingName', false)
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
        },
        isIncludesText: {
            name: '下载文件中包含【微博文本】',
            id: null,
            value: GM_getValue('isIncludesText', false)
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
body{--yellow:#ff8200}.head-info_info_2AspQ:not(.Feed_retweetHeadInfo_Tl4Ld):after,div.card-feed div.from:after{content:"下载" attr(show-text);color:var(--yellow);cursor:pointer;float:right}.main-full.isFirst div.card-feed div.from:after,.Main_full_1dfQX.isFirst .head-info_info_2AspQ:not(.Feed_retweetHeadInfo_Tl4Ld):after{animation:wobble 1s infinite alternate}@keyframes wobble{0%{-webkit-transform:translateZ(0);transform:translateZ(0)}15%{-webkit-transform:translate3d(-25%,0,0) rotate(-5deg);transform:translate3d(-25%,0,0) rotate(-5deg)}30%{-webkit-transform:translate3d(20%,0,0) rotate(3deg);transform:translate3d(20%,0,0) rotate(3deg)}45%{-webkit-transform:translate3d(-15%,0,0) rotate(-3deg);transform:translate3d(-15%,0,0) rotate(-3deg)}60%{-webkit-transform:translate3d(10%,0,0) rotate(2deg);transform:translate3d(10%,0,0) rotate(2deg)}75%{-webkit-transform:translate3d(-5%,0,0) rotate(-1deg);transform:translate3d(-5%,0,0) rotate(-1deg)}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}.Frame_content_3XrxZ #wah0713,.m-main #wah0713{font-size:12px;font-weight:700}.Frame_content_3XrxZ #wah0713.out,.m-main #wah0713.out{opacity:0}.Frame_content_3XrxZ #wah0713.out:hover,.m-main #wah0713.out:hover{opacity:1}.Frame_content_3XrxZ #wah0713 .container,.m-main #wah0713 .container{position:fixed;left:0;z-index:1}.Frame_content_3XrxZ #wah0713:hover .editName,.Frame_content_3XrxZ #wah0713:hover .input-box,.m-main #wah0713:hover .editName,.m-main #wah0713:hover .input-box{display:block}.Frame_content_3XrxZ #wah0713 input,.m-main #wah0713 input{width:3em;color:var(--yellow);border-width:1px;outline:0;background-color:transparent}.Frame_content_3XrxZ #wah0713 .input-box,.m-main #wah0713 .input-box{display:none}.Frame_content_3XrxZ #wah0713 .showMessage>p,.m-main #wah0713 .showMessage>p{line-height:16px;margin:4px}.Frame_content_3XrxZ #wah0713 .showMessage>p span,.m-main #wah0713 .showMessage>p span{color:#333}.Frame_content_3XrxZ #wah0713 .showMessage>p span.red,.m-main #wah0713 .showMessage>p span.red{color:var(--yellow);vertical-align:top}.Frame_content_3XrxZ #wah0713 .showMessage>p span.red.downloadBtn,.m-main #wah0713 .showMessage>p span.red.downloadBtn{cursor:pointer}.Frame_content_3XrxZ #wah0713 .showMessage>p a,.m-main #wah0713 .showMessage>p a{color:#333;overflow:hidden;text-overflow:ellipsis;max-width:300px;display:inline-block;white-space:nowrap}.Frame_content_3XrxZ #wah0713 .showMessage>p a:hover,.m-main #wah0713 .showMessage>p a:hover{text-decoration:none}.Frame_content_3XrxZ #wah0713 .editName,.m-main #wah0713 .editName{display:none;border:1px solid #ccc;padding:2px;border-radius:6px;user-select:none}.Frame_content_3XrxZ #wah0713 .editName ul,.m-main #wah0713 .editName ul{list-style:none;display:flex;height:20px;margin:0;padding:0;background-color:#fafafa}.Frame_content_3XrxZ #wah0713 .editName li,.m-main #wah0713 .editName li{height:20px;line-height:20px;background:#ff3852;color:#fff;padding-inline:3px;border-left:2px solid #fafafa;font-size:12px;cursor:grab;border-radius:5px}.Frame_content_3XrxZ #wah0713 .unactive li,.m-main #wah0713 .unactive li{background:#ff9406}.Frame_content_3XrxZ #wah0713 .outline,.m-main #wah0713 .outline{outline:2px solid #119da6}
                `)

    // // debugJS
    // isDebug = true
    // unsafeWindow.$ = $
})()