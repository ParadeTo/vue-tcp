<template>
  <div id="wrapper">
    <header id="header">
      <div class="sec">
        <div id="timer">
          <div :style="'width:' + client.time + '%;'"></div>
        </div>
      </div>
      <div class="sec">
        <button @click="onAllPause()" >{{isPause ? 'Resume' : 'Pause'}}</button>
      </div>
      <div class="sec">
        <p>
          缓存大小：<input type='range' min='1' max='15' v-model='server.maxRcvBuffer'/>
        </p>
        <p>
          窗口大小：<input type='range' min='1' :max="server.maxRcvBuffer" v-model='maxWindow' />
        </p>
      </div>
    </header>
    <main id="main">
      <section id="client">
        <h2>client</h2>
        <p class="btns">
          <button @click="onSend">Send</button>
        </p>
        <ul class="packs">
          <span class="window" :style="'height:' + 35 * window + 'px;' + 'top:' + client.lastByteAcked * 35 + 'px'"></span>
          <span id="lastByteAcked" class="arrow" :style="'top:' + 35 * client.lastByteAcked + 'px'">lastByteAcked</span>
          <span id="lastByteSent" class="arrow" :style="'top:' + 35 * client.lastByteSent + 'px'">lastByteSent</span>
          <li v-for="p in client.packs" :key="p.seq" v-html="p.seq" :class="{'pack': true,'sent': p.status.client >= 1}"></li>
        </ul>
      </section>
      <section id="path">
        <div v-for="p in sendingPacks" :key="'seq'+p.seq" class='sending-pack' :style="'transform: translate('+p.x+'px,'+p.seq*pathPackSize+'px)'">
          <p class='operation'>
            <span class='down' @click='onDown(p)'></span>
            <span class='up' @click='onUp(p)'></span>
            <!--<span class='pause' ></span>-->
            <span class='remove' @click='onRemove(p)'></span>
          </p>
          <p v-html="p.seq"></p>
        </div>
        <div v-for="p in ackingPacks" :key="'ack'+p.ack" class='acking-pack' :style="'transform: translate('+p.x+'px,'+(p.ack-1)*pathPackSize+'px)'">
          <p class='operation'>
            <span class='down' @click='onUp(p)'></span>
            <span class='up' @click='onDown(p)'></span>
            <!--<span class='pause' ></span>-->
            <span class='remove' @click='onRemove(p, true)'></span>
          </p>
          <p v-html="p.ack"></p>
        </div>
      </section>
      <section id="server">
        <h2>server</h2>
        <p class="btns">
          <button @click="onRead">Read</button>
        </p>
        <ul class="packs">
          <span class="rcv-buffer" :style="'height:' + 35 * server.maxRcvBuffer + 'px;' + 'top:' + server.lastByteRead * 35 + 'px'"></span>
          <span class="window" :style="'height:' + 35 * window + 'px;' + 'top:' + (server.nextByteExpected - 1) * 35 + 'px'"></span>
          <span id="lastByteRead" class="arrow" :style="'top:' + 35 * server.lastByteRead + 'px'">lastByteRead</span>
          <span id="nextByteExpected" class="arrow" :style="'top:' + 35 * (server.nextByteExpected - 1) + 'px'">nextByteExpected</span>
          <li v-for="p in client.packs" :key="p.seq" v-html="p.seq" :class="{'server-pack': true, 'received': p.status.server === 1, 'readed': p.status.server === 2}"></li>
        </ul>
      </section>
    </main>
  </div>
</template>

<script>
import { animate, removeItemInArr } from './utils.js'
import { clearTimeout } from 'timers';

export default {
  data () {
    const packs = []
    for (let i = 0; i < 15; i++) {
      packs.push({
        seq: i + 1,
        /**
          client:
          0：未发送
          1：已发送未确认
          2：已发送已确认
          server:
          0：未收到
          1：已收到
          2：已收到已确认
         */
        status: {
          client: 0,
          server: 0
        },
        x: 0
      })
    }

    return {
      ott: 3000, // one trip time
      pathPackSize: 50,
      client: {
        timer: null,
        time: 0,
        packs: packs,
        lastByteAcked: 0,
        lastByteSent: 0
      },
      sendingPacks: [],
      ackingPacks: [],
      window: 4,
      maxWindow: 4,
      server: {
        packs: packs,
        lastByteRead: 0,
        nextByteExpected: 1,
        maxRcvBuffer: 4
      },
      isPause: false
    }
  },
  created: function () {
    this.animateList = []
  },
  mounted: function () {
    this.pathWidth = document.querySelector('#path').offsetWidth
  },
  watch: {
    maxWindow: function (val) {
      this.window = val
      console.log(val)
    }
  },
  methods: {
    onUp: function (p) {
      p.animate.nextStep()
    },
    onDown: function (p) {
      p.animate.lastStep()
    },
    onRemove: function (p, ack = false) {
      removeItemInArr(ack ? this.ackingPacks : this.sendingPacks, p)
      p.animate.destroy()
    },
    onSend: function () {
      if (this.client.lastByteSent - this.client.lastByteAcked >= this.window) return
      const pack = this.client.packs[this.client.lastByteSent++]
      this.send(pack)
      this.setTimer()
    },
    onRead: function () {
      const pack = this.server.packs[this.server.lastByteRead]
      if (pack.status.server !== 1) return
      this.server.lastByteRead++
      pack.status.server = 2
      this.setWindow()
    },
    send: function (pack) {
      pack.status.client = 1
      this.sendingPacks.push(pack)
      this.animateSendingPack(pack)
    },
    reSend: function () {
      // resend the last acked pack's seq + 1
      for (let i = 0, len = this.client.packs.length; i < len; i++) {
        const p = this.client.packs[i]
        if (p.status.client === 1 && p.seq === this.client.lastByteAcked + 1) {
          this.send(p)
          this.setTimer()
          break
        }
      }
    },
    onAllPause: function () {
      this.isPause = !this.isPause
      console.log('askdgj')
      if (this.isPause) {
        this.animateList.forEach(a => {
          if (a.isDestroy()) a = null
          else a.pause()
        })
      } else {
        this.animateList.forEach(a => {
          if (a.isDestroy()) a = null
          else a.resume()
        })
      }
    },
    onPauseOrResume: function (p) {
      p.animate.pause()
    },
    getAckPack: function () {
      let nextByteExpected = 0
      for (let i = 0, len = this.server.packs.length; i < len; i++) {
        const pack = this.server.packs[i]
        if (pack.status.server === 0) {
          nextByteExpected = pack.seq
          break
        }
      }
      return {
        ack: nextByteExpected,
        x: this.pathWidth - this.pathPackSize
      }
    },
    onSending: function (value, done, pack) {
      pack.x = value
      if (done) { // server receive pack
        pack.status.server = 1
        pack.animate.destroy()
        removeItemInArr(this.sendingPacks, pack)

        const ackPack = this.getAckPack()
        this.ackingPacks.push(ackPack)
        this.animateAckingPack(ackPack)

        this.setNextByteExpected()
        this.setWindow()
      }
    },
    onAcking: function (value, done, pack) {
      pack.x = value
      if (done) { // client receive ack pack from server
        this.client.lastByteAcked = this.client.lastByteAcked > pack.ack - 1 ? this.client.lastByteAcked : pack.ack - 1
        this.client.packs.forEach(p => {
          if (p.seq <= pack.seq) {
            p.status.server = 2
          }
        })
        removeItemInArr(this.ackingPacks, pack)
      }
    },
    setNextByteExpected () {
      for (let i = 0, len = this.server.packs.length; i < len; i++) {
        const p = this.server.packs[i]
        if (p.status.server === 0) {
          this.server.nextByteExpected = p.seq
          break
        }
      }
    },
    setWindow () {
      const remain = this.server.maxRcvBuffer - this.server.nextByteExpected + this.server.lastByteRead + 1
      // debugger
      // if (this.window > remain || this.window === 0) {
      this.window = remain > this.maxWindow ? this.maxWindow : remain
      // }
    },
    animateAckingPack: function (pack) {
      const vm = this
      const animateObj = animate({
        from: this.pathWidth - vm.pathPackSize,
        to: 0,
        duration: vm.ott,
        isPause: this.isPause,
        callback: function (value, done) {
          vm.onAcking(value, done, pack)
        }
      })
      pack.animate = animateObj
      this.animateList.push(animateObj)
    },
    animateSendingPack: function (pack) {
      const vm = this
      const animateObj = animate({
        from: 0,
        to: this.pathWidth - vm.pathPackSize,
        duration: vm.ott,
        isPause: this.isPause,
        callback: function (value, done) {
          vm.onSending(value, done, pack)
        }
      })
      pack.animate = animateObj
      this.animateList.push(animateObj)
    },
    setTimer: function () {
      const vm = this
      if (this.timer) this.timer.destroy()
      this.timer = animate({
        from: 0,
        to: 2 * this.ott + 1000,
        duration: 2 * this.ott + 1000,
        isPause: this.isPause,
        callback: function (value, done) {
          vm.client.time = value / (2 * vm.ott + 1000) * 100
          if (done) { // time out
            vm.reSend() // select and resend
          }
        }
      })
      this.animateList.push(this.timer)
    }
  }
}
</script>

<style lang="less" scoped>
#wrapper {
  button {
    padding: 0 5px;
  }
  #header {
    height: 100px;
    text-align: center;
    padding: 30px 0;
    display: flex;
    button {
      height: 30px;
    }
    .sec {
      flex: 1;
      text-align: center;
    }
    #timer {
      width: 90%;
      display: inline-block;
      border: 1px solid gray;
      height: 30px;
      padding: 2px;
      div{
        background-color: #00d1b2;
        height: 100%;
      }
    }
  }
  #main {
    display: flex;
    section {
      flex: 1;
      text-align: center;
      min-height: 500px;
    }
    #client {
      border-right: 4px solid gray;
    }
    #server {
      border-left: 4px solid gray;
    }
    .btns {
      padding: 5px 0;
    }
    .packs {
      display: inline-block;
      position: relative;
      padding-left: 0;
      .pack, .server-pack {
        color: #aaa;
        list-style: none;
        box-sizing: border-box;
        &.sent {
          color: black;
        }
      }
      .window, .rcv-buffer {
        box-sizing: border-box;
        display: inline-block;
        width: 35px;
        border: 1px solid red;
        position: absolute;
        left: 0;
        transition: top linear 0.3s;
      }
      .rcv-buffer {
        border: 1px solid blue;
        width: 39px;
        left: -2px;
      }
      .arrow {
        width: 35px;
        height: 2px;
        position: absolute;
        left: 102%;
        text-align: right;
        text-indent: 102%;
        line-height: 2px;
        font-size: 12px;
        transition: top linear 0.3s;
      }
      #lastByteAcked, #lastByteRead {
        background: blue;
      }
      #lastByteSent, #nextByteExpected {
        background-color: green;
      }
      li {
        width: 35px;
        height: 35px;
        line-height: 35px;
        border: 1px solid #aaa;
        border-bottom: none;
        &:last-of-type {
          border-bottom: 1px solid #aaa;
        }
      }
    }
    #path {
      position: relative;
      .sending-pack, .acking-pack {
        position: absolute;
        width: 50px;
        height: 50px;
        line-height: 50px;
        border: 1px solid #23d160;
        box-sizing: border-box;
        .operation {
          line-height: 1;
          margin: 0;
          display: flex;
          position: absolute;
          width: 100%;
          span {
            flex:1;
            height: 12.5px;
            line-height: 8px;
            text-align: center;
            &::after {
              content: '';
              display: inline-block;
              width: 6px;
              height: 6px;
            }
            &:hover {
              background-color: orange;
            }
          }
          .down, .up {
            &::after {
              border-top: 1px solid black;
              border-left: 1px solid black;
              transform: rotate(-45deg);
            }
          }
          .up {
            &::after {
              transform: rotate(135deg);
            }
          }
          .pause {
            &::after {
              border-left: 1px solid black;
              border-right: 1px solid black;
              transform: scaleX(0.5);
            }
          }
          .remove {
            position: relative;
            &::after {
              position: absolute;
              width: 1px;
              height: 8px;
              background-color: black;
              transform: rotate(45deg);
              top: 2px;
            }
            &::before {
              position: absolute;
              content: '';
              display: inline-block;
              width: 1px;
              height: 8px;
              background-color: black;
              transform: rotate(-45deg);
              top: 2px;
            }
          }
        }
      }
      .acking-pack {
        border: 1px solid #ff3860;
      }
    }
  }
}
</style>


