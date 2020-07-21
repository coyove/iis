function $q(q, multi) {
    if (q.match(/^<\S+>$/)) return document.createElement(q.substring(1, q.length - 1));
    var el = document.querySelectorAll(q), ela = [];
    if (el.length === 1 && !multi) return el[0];
    for (var i = 0; i < el.length; i++) ela.push(el[i]);
    return ela;
}

function $html(h) {
    var div = $q("<div>")
    div.innerHTML = h;
    return div.firstElementChild
}

function $value(el) {
    return el && el.getAttribute && el.getAttribute("value")
}

function $wait(el) {
    var waiting = 0,
        stopped = false,
        oldHTML = el.innerHTML,
        specialClass = el.className.match(/icon-\S+/g),
        timer = setInterval(function () {
            waiting++;
            el.innerHTML = "<b style='font-family:monospace;font-size:inherit'>" + "|/-\\".charAt(waiting % 4) + "</b>";
        }, 100);

    el.setAttribute("disabled", "disabled");
    el.className = el.className.replace(/icon-\S+/, '');

    return function() {
        if (stopped) return;
        stopped = true;
        el.removeAttribute("disabled");
        clearInterval(timer);
        el.innerHTML = oldHTML;
        el.className += (specialClass || []).join('');
    }
}

function $popup(html, bg) {
    var div = $html("<div class=toast></div>");
    div.innerHTML = html;
    div.onclick = function() {
        div.style.transition = "opacity 0.8s";
        div.style.opacity = "0";
        setTimeout(function() {div.parentNode.removeChild(div)}, 1000);
    }
    document.body.appendChild(div);
    setTimeout(div.onclick, 2000)
}

function $post(url, data, cb, errorcb) {
    var xml = new XMLHttpRequest(), m = document.cookie.match(/(^| )id=([^;]+)/);
    var cbres = null;
    xml.onreadystatechange = function() {
        if (xml.readyState != 4) return;
        if (xml.status == 200) {
            var res = xml.responseText;
            if ((xml.getResponseHeader('Content-Type') || "").match(/json/)) {
                try { res = JSON.parse(res) } catch(e) {}
            }

            cbres = cb(res, xml)
            if (!cbres) return;

            // callback returns error
            cbres = __i18n(cbres);
        }
        xml.onerror();
    }
    xml.onerror = function() {
        if (cbres == 'ok') {
            $popup('<i class=icon-ok-circled></i>成功');
        } else if (cbres && cbres.match(/^ok:/)) {
            $popup('<i class=icon-ok-circled></i>' + cbres.substring(3));
        } else {
            if (errorcb) errorcb(xml)
            var text = "错误状态: " + xml.status;
            if (xml.status === 404) text = "内容未找到";
            $popup('<i class=icon-cancel-circled-1></i>' + (cbres || text));
        }
    }
    xml.open("POST", url, true);
    xml.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    var q = "api=1&api2_uid=" + (m ? m[2] : "");
    for (var k in data) {
        if (data.hasOwnProperty(k)) q += '&' + k + '=' + encodeURIComponent(data[k]);
    }
    xml.send(q);
}

function $postReload(el, url, data) {
    var stop = $wait(el);
    $post(url, data, function(res) {
        stop();
        if (res != "ok") return res;
        try {
            var r = new URLSearchParams(window.location.search).get('redirect');
            if (r) {
                location.href = r;
                return;
            }
        } catch(e) {}
        location.reload();
    }, stop)
}

function loadKimochi(el) {
    var ul = el.querySelector('ul');
    if (ul.childNodes.length) return;

    for (var i = 0; i <= 44; i++) {
        var li = z.html('<li>'), a = z.html('<a>'), img = z.html('<img>');
        img.src = '/s/emoji/emoji' + i + '.png';
        if (i == 0) {
            img.className = 'kimochi-selector';
            img.setAttribute("kimochi", "0");
        }
        a.appendChild(img);
        a.onclick = (function(i, img) {
            return function() {
                img.src = '/s/assets/spinner2.gif';
                $post('/api/user_kimochi', {k: i}, function(resp) {
                    if (resp === 'ok')  location.reload(); 
                });
            }
        })(i, img)
        li.appendChild(a);
        ul.appendChild(li);
    }
}

function isInViewport(el, scale) {
    var top = el.offsetTop, height = el.offsetHeight, h = window.innerHeight, s = scale || 0;
    while (el.offsetParent) {
        el = el.offsetParent;
        top += el.offsetTop;
    }
    return top < (window.pageYOffset + h + h*s) && (top + height) > window.pageYOffset - h*s;
} 

function likeArticle(el, id) {
    var v = el.getAttribute("liked") === "true" ? "" : "1",
        num = el.querySelector('span.num'),
        icon = el.querySelector('i');
    var stop = $wait(num);
    $post("/api2/like_article", {like:(v || ""), to:id}, function(res) {
        stop();
        if (res !== "ok") return res;
        if (v) {
            el.setAttribute("liked", "true")
            icon.className = 'icon-heart-filled';
            num.innerText = (parseInt(num.innerText) || 0) + 1;
        } else {
            el.setAttribute("liked", "false")
            icon.className = 'icon-heart-1';
            num.innerText = parseInt(num.innerText) ? (parseInt(num.innerText) - 1) : 0;
        }
    }, stop);
}

function deleteArticle(el, id) {
    if (!confirm("是否确认删除该发言？该操作不可逆")) return;
    var stop = $wait(el);
    $post("/api2/delete", { id: id }, function (res) {
        stop();
        if (res != "ok") return res;
        $q("[data-id='" + id + "'] > pre", true).forEach(function(e) {
            e.innerHTML = "<span class=deleted></span>";
        });
        $q("[data-id='" + id + "'] .media img", true).forEach(function(e) {
            e.src = '';
        });
        $q("[data-id='" + id + "'] .media", true).forEach(function(e) {
            e.style.display = 'none';
        });
    }, stop)
}

function nsfwArticle(el, id) {
    var stop = $wait(el);
    $post("/api2/toggle_nsfw", { id: id }, function (res) {
        stop();
        if (res != "ok") return res;
        el.setAttribute("value", !($value(el) === 'true'))
        return "ok";
    }, stop);
}

function dropTopArticle(el, id) {
    if (!confirm("是否取消置顶")) return;
    $postReload(el, "/api2/drop_top", { id: id, extra: "" })
}

function lockArticle(el, id) {
    var div = $html('<div style="position:absolute;box-shadow:0 1px 5px rgba(0,0,0,.3);" class=tmpl-light-bg></div>'),
        box = el.getBoundingClientRect(),
        bodyBox = document.body.getBoundingClientRect(),
        currentValue = $value(el),
        reg = {};

    div.style.left = box.left - bodyBox.left + "px";
    div.style.top = box.bottom - bodyBox.top + "px";

    var checkbox = function(i, t) {
        var xid = "lala" + (Math.random() * 1000).toFixed(0);
        var r = $html("<div style='margin:0.5em'>" +
            "<input value=" + i + " type=radio name=reply-lock class=icon-input-checkbox id=" +
            xid + (i == currentValue ? " checked" : "") + ">" +
            "<i class='icon-ok-circled2'></i> <label for=" + xid + ">" + t + "</label></div>")
        return r;
    }
    div.appendChild(checkbox(0, "不限制回复"))
    div.appendChild(checkbox(1, "禁止回复"))
    div.appendChild(checkbox(2, "我关注的人可回复"))
    div.appendChild(checkbox(3, "我关注的人和被@的人可回复"))
    div.appendChild(checkbox(4, "我关注的人和我粉丝可回复"))
    document.body.appendChild(div)

    if (id) div.appendChild($html("<div style='margin:0.5em;text-align:center'><button class=gbutton>更新设置</div></div>"))

    reg = { valid: true, boxes: [el, div], callback: function(x, y) {
        if (!id) {
            var v = (div.querySelector("[name=reply-lock]:checked") || {}).value;
            if (v) el.setAttribute("value", v)
        }
        div.parentNode.removeChild(div);
    }, };
    window.REGIONS = window.REGIONS || [];
    window.REGIONS.push(reg);

    if (!id) return;
    div.querySelector('button').onclick = function(e) {
        var stop = $wait(e.target), v = div.querySelector("[name=reply-lock]:checked").value;
        $post("/api2/toggle_lock", { id: id, mode: v }, function (res) {
            stop();
            if (res != "ok") return res;
            el.setAttribute("value", v)
            el.innerHTML = v > 0 ?
                '<i class="tmpl-normal-text icon-lock"></i>' :
                '<i class="tmpl-light-text icon-lock-open"></i>'
            return "ok:回复设置更新"
        }, stop);
    }
}

function followBlock(el, m, id) {
    if (m == "block" && $value(el) === "false") {
        if (window.localStorage.getItem('not-first-block') != 'true') {
            if (!confirm("是否确定拉黑" + id)) {
                return;
            }
            window.localStorage.setItem('not-first-block', 'true')
        }
    }
    var stop = $wait(el), obj = { method: m };
    id = id || el.getAttribute("user-id");
    obj[m] = $value(el) === "true" ? "" : "1";
    obj['to'] = id;
    $post("/api2/follow_block", obj, function(res) {
        stop();
        if (res != "ok") return res;
        el.setAttribute("value", obj[m] == "" ? "false" : "true");
        if (m == "follow") {
            el.innerHTML = '<i class=' + ((obj[m] != "") ? "icon-heart-broken" : "icon-user-plus") + "></i>";
            return "ok:" + ((obj[m] != "") ? "已关注" + id : "已取消关注" + id);
        } else if (m == "accept") {
            el.style.display = "none";
        } else {
            el = el.querySelector('i');
            el.className = el.className.replace(/block-\S+/, '') + " block-" + (obj[m] != "");
            el = el.nextElementSibling;
            if (el) el.innerText = obj[m] != "" ? "解除" : "拉黑";
            return "ok:" + ((obj[m] != "") ? "已拉黑" + id : "已解除" + id + "拉黑状态")
        }
    }, stop)
}

function __i18n(t) {
    if (t.match(/guard\/cooling-down\/([0-9\.]+)s/)) 
        return "请等待" + t.split("/").pop();
    if (t === "guard/failed-captcha")
        return "无效验证码";
    if (t === "guard/token-expired")
        return "Token过期，请重试";
    if (t === "content/too-short")
        return "正文过短";
    if (t === "title/too-short")
        return "标题过短";
    if (t === "error/can-not-reply")
        return "无法回复";
    if (t === "internal/error")
        return "服务端异常";
    if (t === "guard/id-not-existed")
        return "ID不存在";
    if (t === "user/not-logged-in")
        return "请登入后操作";
    if (t === "password/invalid-too-short")
        return "密码太短或不符";
    if (t === "id/already-existed")
        return "ID已存在";
    if (t === "id/too-short")
        return "无效ID";
    if (t === "user/not-allowed")
        return "无权限";
    if (t === "follow/to-blocked")
        return "已被拉黑";
    if (t === "follow/to-following-required")
        return "需要对方先关注你";
    if (t === "error/block-tag")
        return "无法拉黑标签";
    return t;
}

function loadMore(tlid, el, data) {
    data.cursors = $value(el);
    var stop = $wait(el);
    $post('/api/timeline', data, function(pl) {
        stop();
        if (pl.EOT) {
            el.innerText = "没有更多内容了";
            el.setAttribute("eot", "true");
            el.className += " tmpl-light-text";
            el.onclick = function() { location.reload() }
        } else {
            el.innerText = "更多...";
        }
        if (pl.Articles) {
            el.setAttribute("value", pl.Next);
            pl.Articles.forEach(function(a) {
                var dedup = $q('#' + tlid + " > [data-id='" + a[0] + "']");
                if (dedup && dedup.length) {
                    console.log("dedup:", a[0])
                    return;
                }
                var div = document.createElement("div");
                div.innerHTML = a[1];
                $q('#' + tlid).appendChild(div.querySelector("div"));
            })
        }
        expandNSFW();
        if (!data.reply)
            history.pushState("", "", location.pathname + location.search)
    }, stop);
    //   console.log(document.documentElement.scrollTop);
}

function preLoadMore(tlid, nextBtn) {
    window.addEventListener('scroll', function(e) {
        if (!window.ticking) {
            window.requestAnimationFrame(function() {
                $q("#" + tlid + " > .row", true).forEach(function(c) {
                    if (isInViewport(c, 3)) {
                        if (c.childNodes.length == 0) {
                            c.innerHTML = c.__html;
                            c.style.height = "";
                        }
                    } else {
                        if (c.childNodes.length) {
                            c.style.height = c.offsetHeight + "px";
                            c.__html = c.innerHTML;
                            c.innerHTML = "";
                        }
                    }
                })
                if (isInViewport(nextBtn) &&
                    !nextBtn.getAttribute("disabled") && nextBtn.getAttribute("eot") !== "true") {
                    console.log("Load next");
                    nextBtn.click();
                }
                window.ticking = false;
            });
            window.ticking = true;
        }
    });
}

// Nested replies view
function showReply(aid, closeToHome) {
    // We have something popped up already, wait them to be removed first
    if (window.REGIONS && window.REGIONS.length) return;

    // User selected some texts on the page, so we won't pop up
    if (window.getSelection && window.getSelection().type == 'Range') return;

    $q(".image-uploader.dropzone", true).forEach(function(el) { el.UPLOADER ? el.UPLOADER.removeAllFiles() :0})

    var div = $q('<div>');
    div.id = 'Z' + Math.random().toString(36).substr(2, 5);
    div.className = 'div-inner-reply tmpl-body-bg';
    div.style.position = 'fixed';
    div.style.left = '0';
    div.style.top = '0';
    div.style.width = '100%';
    div.style.height = '100%';
    div.style.backgroundColor = 'white';
    div.style.overflowY = 'scroll';
    div.style.overflowX = 'hidden';
    div.style.backgroundImage = 'url(/s/assets/spinner.gif)';
    div.style.backgroundRepeat = 'no-repeat';
    div.style.backgroundPosition = 'center center';

    // Close duplicated windows before opening a new one
    $q("[data-parent='" + aid + "']", true).forEach(function(e) { e.CLOSER.click(); });
    div.setAttribute('data-parent', aid);

    var divclose = $html(
        "<div style='margin:0 auto' class='container rows replies'><div class=row style='padding:0.5em;line-height:30px;display:flex'>" +
        "<i class='control icon-left-small'></i>" + 
        "<input style='margin:0 0.5em;width:100%;text-align:center;border:none;background:transparent;cursor:pointer' value='" +
        location.protocol + "//" +  location.host + "/S/" + aid.substring(1) +
        "' onclick='this.select();document.execCommand(\"copy\");$popup(\"已复制\")' readonly>" +
        "<i class='control icon-link' onclick='this.previousElementSibling.click()'></i>" + 
        "</div></div>");

    div.CLOSER = divclose.querySelector('.icon-left-small')
    div.CLOSER.onclick = function() {
        if (closeToHome) { location.href = "/t"; return }

        div.parentNode.removeChild(div)
        if ($q('[data-parent]', true).length === 0) {
            history.pushState("", "", location.pathname + (window.IS_MEDIA ? '?media=1' : ''));
            document.body.style.overflow = null;
        }
    }
    divclose.insertBefore($q("nav", true)[0].cloneNode(true), divclose.firstChild);

    div.appendChild(divclose);
    document.body.appendChild(div);
    document.body.style.overflow = 'hidden';

    $post('/api/p/' + aid, {}, function(h) {
        div.innerHTML = h;
        div.style.backgroundImage = null;
        var rows = div.querySelector('.rows'),
            box = div.querySelector(".reply-table textarea"),
            uploader = div.querySelector(".reply-table .image-uploader");

        if (box) window.TRIBUTER.attach(box);
        if (uploader) attachImageUploader(uploader);

        rows.insertBefore(divclose.querySelector('.row'), rows.firstChild);
        rows.insertBefore($q("nav", true)[0].cloneNode(true), rows.firstChild);
    });

    window.IS_MEDIA = window.IS_MEDIA || location.search.indexOf('media') >= 0;
    history.pushState("", "", location.pathname + "?pid=" + encodeURIComponent(aid) + location.hash + "#" + div.id)
}

window.onpopstate = function(event) {
    var closes = $q(".div-inner-reply", true)
    location.href.split("#").forEach(function(id) {
        closes = closes.filter(function(c) { return c.id != id })
    })
    closes.forEach(function(c) { c.CLOSER.click() })
};

function updateSetting(el, field, value, cb, errcb) {
    var data = {},
        stop = $wait(el.tagName === 'INPUT' && el.className == "icon-input-checkbox" ?
            el.nextElementSibling.nextElementSibling: el);
    data["set-" + field] = "1";
    if (field !== 'bio') {
        data[field] = value;
    } else {
        ["description"].forEach(function(id) { data[id] = $q("[name='" + id + "']").value })
    }
    $post("/api/user_settings", data, function(h, h2) {
        stop();
        if (cb) cb(h, h2);
        return h
    }, function() {
        stop();
        if (errcb) errcb();
    })
}

function showInfoBox(el, uid) {
    if (el.BLOCK) return;
    el.BLOCK = true;

    var div = $q("<div>"),
        loading = $html("<div style='position:absolute;left:0;top:0;width:100%;height:100%'></div>"),
        bodyBox = document.body.getBoundingClientRect(),
        box = el.getBoundingClientRect(),
        boxTopOffset = 0,
        addtionalBoxes = [],
        startAt = new Date().getTime();

    div.innerHTML = $q("#dummy-user").innerHTML;
    div.querySelector('img.avatar').src = el.src || '';
    div.querySelector('img.avatar').onclick = null;

    if (el.className === 'mentioned-user') {
        div.querySelector('span.post-author').innerHTML = el.innerHTML;
    } else {
        for (var x = el.parentNode; x ; x = x.parentNode) {
            var pa = x.querySelector('span.post-author')
            if (pa) {
                div.querySelector('span.post-author').innerHTML = pa.innerHTML;
                break;
            }
        }
    }

    for (var x = el; x ; x = x.parentNode) {
        if (x.getAttribute('data-id') || x.className === 'mentioned-user') {
            box = x.getBoundingClientRect();
            if (x.className === 'mentioned-user') {
                addtionalBoxes.push(x);
                boxTopOffset = box.bottom - box.top;
            }
            break;
        }
    }

    div.style.position = 'absolute';
    div.style.left = box.left - bodyBox.left + 'px';
    div.style.top = box.top - bodyBox.top + boxTopOffset + 'px';
    div.style.boxShadow = "0 1px 2px rgba(0, 0, 0, .3)";
    document.body.appendChild(div);

    var reg = {
        valid: true,
        boxes: [div].concat(addtionalBoxes),
        callback: function(x, y) {
            div.parentNode.removeChild(div);
            el.BLOCK = false;
        },
    };

    window.REGIONS = window.REGIONS || [];
    window.REGIONS.push(reg);

    $post("/api/u/" + uid, {}, function(h) {
        if (h.indexOf("ok:") > -1) {
            setTimeout(function() {
                div.innerHTML = h.substring(3)
                var newBox = div.getBoundingClientRect();
                if (newBox.right > bodyBox.right) {
                    div.style.left = null;
                    div.style.right = "0";
                }
            }, new Date().getTime() - startAt > 100 ? 0 : 100)
            return
        }
        return h
    }, function() {
        el.BLOCK = false;
    })
}

function adjustImage(img) {
    var ratio = img.width / img.height,
        div = img.parentNode.parentNode,
        note = div.querySelector('.long-image'),
        r = div.getBoundingClientRect(),
        smallimg = false;

    if (ratio < 0.33 || ratio > 3) {
        div.style.backgroundSize = 'contain';
        note.style.display = 'block';
    } else {
        div.style.backgroundSize = 'cover';
    }

    if (img.width <= r.width * 0.9 && img.height <= r.height * 0.9) {
        div.style.backgroundSize = 'auto';
        smallimg = true;
    }

    if (img.src.match(/\.gif$/)) {
        note.style.display = 'block';
        note.innerText = 'GIF';
    }

    if (div.hasAttribute("enlarge")) {
        // Raw image and its thumbnail may have different w/h ratios, so recalc is needed
        // div.style.height = div.getBoundingClientRect().width / ratio + "px";
        // if (smallimg) div.style.height = img.height + "px";
        div.style.height = window.innerHeight + "px";
        div.scrollIntoView();
        div.style.backgroundSize = 'contain';
    }

    div.style.backgroundImage = 'url(' + img.src + ')';
    div.onclick = function() {
        if (!div.hasAttribute("enlarge")) {
            div.setAttribute("enlarge", "enlarge")
            div.style.width = "100%";
            div.style.height = window.innerHeight + "px";
            div.style.borderRadius = '0';
            div.scrollIntoView();

            var imgload = new Image(), imgprogress = new Image(), divC = $q("<div>"), loaded = false;

            imgload.src = img.src.replace(/\/thumb\//, '/');
            imgload.onload = function() {
                loaded = true;
                img.src = imgload.src; // trigger adjustImage() again
                try { div.removeChild(divC) } catch (e) {}
            }

            imgprogress.src =  '/s/assets/spinner.gif';
            imgprogress.setAttribute('style', 'opacity:unset;display:block;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);');
            divC.className = 'image-loading-div';
            divC.appendChild(imgprogress);
            div.appendChild(divC);

            setTimeout(function() { if (!loaded) divC.style.opacity = '1' }, 100)
        } else {
            div.removeAttribute("enlarge")
            div.style.borderRadius = null;
            div.style.width = null;
            div.style.height = null;
        }
    }
}

function adjustVideoIFrame(el, src) {
    el.style.display = 'none';
    el.previousElementSibling.style.display = 'none';
    el = el.nextSibling;
    el.style.display = null;
    var box = el.getBoundingClientRect();
    var w = box.right - box.left;
    el.style.height = (el.getAttribute("fixed-height") || (w*0.75)) + 'px';
    el.src = src;
}

function $aesgcm() {
    function $getKey(key) {
        var k = new Uint8Array(16);
        k.forEach(function(v, i) { k[i] = key.charCodeAt(i) || 1; })
        return window.crypto.subtle.importKey('raw', k, {
            name: 'AES-GCM',
            length: 256
        }, false, ['encrypt', 'decrypt'])
    }

    function $tohex(a) {
        var text = "";
        (new Uint8Array(a)).forEach(function(v) {
            text += ("00" + v.toString(16)).slice(-2)
        })
        return text;
    }

    function $fromhex(text) {
        var a = new Uint8Array(text.length / 2);
        a.forEach(function(v, i) {
            a[i] = parseInt(text.substr(i * 2, 2), 16)
        })
        return a;
    }

    function $encrypt(str, key, cb) {
        var iv = window.crypto.getRandomValues(new Uint8Array(12));
        var algoEncrypt = {
            name: 'AES-GCM',
            iv: iv,
            tagLength: 128
        };
        $getKey(key).then(function (key) {
            var buf = new ArrayBuffer(str.length * 2);
            var bufView = new Uint16Array(buf);
            for (var i = 0, strLen = str.length; i < strLen; i++) {
                bufView[i] = str.charCodeAt(i);
            }
            return window.crypto.subtle.encrypt(algoEncrypt, key, buf);
        }).then(function (cipherText) {
            cb($tohex(cipherText) + $tohex(iv));
        });
    }

    function $decrypt(str, key, cb) {
        $getKey(key).then(function (key) {
            return window.crypto.subtle.decrypt({
                name: 'AES-GCM',
                iv: $fromhex(str.substr(str.length - 24, 24)),
                tagLength: 128
            }, key, $fromhex(str.substring(0, str.length - 24)));
        }).then(function (data) {
            data = String.fromCharCode.apply(null, new Uint16Array(data));
            cb(data)
        }).catch(function (err) {
            cb(false)
        });
    }

    return {
        "encrypt": $encrypt,
        "decrypt": $decrypt,
    }
}

function isDarkMode() {
    return (document.cookie.match(/(^| )mode=([^;]+)/) || [])[2] === 'dark';
}

function attachImageUploader(el) {
    if (el.hasAttribute("uploader")) return;

    el.UPLOADER = new Dropzone(el, {
        url: "/api/upload_image",
        maxFilesize: 16,
        maxFilesize: 3,
        addRemoveLinks: true,
        dictRemoveFile: "删除",
        dictFileTooBig: "文件过大 {{filesize}}M, Max: {{maxFilesize}}M",
        dictCancelUpload: "取消",
    }).on("success", function(f, id) {
        f._removeLink.setAttribute('data-uri', id);
        // var div = $q("<div>");
        // div.innerHTML = "<i class='icon-transgender-alt'></i>";
        // f._removeLink.parentNode.appendChild(div);
    });

    el.setAttribute("uploader", "true");
}

function createAvatar(id) {
    var randseed = new Array(4); // Xorshift: [x, y, z, w] 32 bit values

    function seedrand(seed) {
        randseed.fill(0);

        for(let i = 0; i < seed.length; i++) {
            randseed[i%4] = ((randseed[i%4] << 5) - randseed[i%4]) + seed.charCodeAt(i);
        }
    }

    function rand() {
        // based on Java's String.hashCode(), expanded to 4 32bit values
        const t = randseed[0] ^ (randseed[0] << 11);

        randseed[0] = randseed[1];
        randseed[1] = randseed[2];
        randseed[2] = randseed[3];
        randseed[3] = (randseed[3] ^ (randseed[3] >> 19) ^ t ^ (t >> 8));

        return (randseed[3] >>> 0) / ((1 << 31) >>> 0);
    }

    function createColor() {
        //saturation is the whole color spectrum
        const h = Math.floor(rand() * 360);
        //saturation goes from 40 to 100, it avoids greyish colors
        const s = ((rand() * 40) + 30) + '%';
        //lightness can be anything from 0 to 100, but probabilities are a bell curve around 50%
        const l = ((rand() + rand() + rand() + rand()) * 25) + '%';

        return 'hsl(' + h + ',' + s + ',' + l + ')';
    }

    function createImageData(size) {
        const width = size; // Only support square icons for now
        const height = size;

        const dataWidth = Math.ceil(width / 2);
        const mirrorWidth = width - dataWidth;

        const data = [];
        for(let y = 0; y < height; y++) {
            let row = [];
            for(let x = 0; x < dataWidth; x++) {
                // this makes foreground and background color to have a 43% (1/2.3) probability
                // spot color has 13% chance
                row[x] = Math.floor(rand()*2.3);
            }
            const r = row.slice(0, mirrorWidth);
            r.reverse();
            row = row.concat(r);

            for(let i = 0; i < row.length; i++) {
                data.push(row[i]);
            }
        }

        return data;
    }

    function buildOpts(opts) {
        const newOpts = {};

        newOpts.seed = opts.seed || Math.floor((Math.random()*Math.pow(10,16))).toString(16);

        seedrand(newOpts.seed);

        newOpts.size = opts.size || 8;
        newOpts.scale = opts.scale || 4;
        newOpts.color = opts.color || createColor();
        newOpts.bgcolor = opts.bgcolor || createColor();
        newOpts.spotcolor = opts.spotcolor || createColor();

        return newOpts;
    }

    function renderIcon(opts, canvas) {
        opts = buildOpts(opts || {});
        const imageData = createImageData(opts.size);
        const width = Math.sqrt(imageData.length);

        canvas.width = canvas.height = opts.size * opts.scale;

        const cc = canvas.getContext('2d');
        cc.fillStyle = opts.bgcolor;
        cc.fillRect(0, 0, canvas.width, canvas.height);
        cc.fillStyle = opts.color;

        for(let i = 0; i < imageData.length; i++) {

            // if data is 0, leave the background
            if(imageData[i]) {
                const row = Math.floor(i / width);
                const col = i % width;

                // if data is 2, choose spot color, if 1 choose foreground
                cc.fillStyle = (imageData[i] == 1) ? opts.color : opts.spotcolor;

                cc.fillRect(col * opts.scale, row * opts.scale, opts.scale, opts.scale);
            }
        }

        return canvas;
    }


    var canvas = document.createElement('canvas');
    renderIcon({bgcolor: "#fafbfc", seed: id, size: 5, scale: 10}, canvas);
    return canvas;
}
