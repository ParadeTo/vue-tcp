export const animate = ({ from, to, duration, callback, isPause = false }) => {
  duration = duration || 300
  function easingFunc (t, b, c, d) {
    return c * t / d + b
  }

  let start = 0
  let goBack = false
  let auto = true
  let isDestroy = false
  var during = Math.ceil(duration / 17) // the number of frame

  function fire () {
    let delta = 1
    if (!auto) delta = 3
    if (goBack) delta *= -1
    start += delta
    if (start < 0) start = 0
    const value = easingFunc(start, from, to - from, during)
    if (start <= during) {
      callback(value)
      auto && window.requestAnimationFrame(step)
    } else {
      callback(to, true)
    }
  }

  var step = function () {
    if (isPause || isDestroy) return
    fire()
  }

  !isPause && !isDestroy && step()
  return {
    pause: function () {
      isPause = true
    },
    resume: function () {
      auto = true
      goBack = false
      isPause = false
      step()
    },
    destroy: function () {
      isDestroy = true
    },
    isDestroy: function () {
      return isDestroy
    },
    isPause: function () {
      return isPause
    },
    nextStep: function () {
      auto = false
      goBack = false
      fire()
    },
    lastStep: function () {
      auto = false
      goBack = true
      fire()
    }
  }
}

export const removeItemInArr = (arr, item, isSame = (a, b) => a.seq === b.seq) => {
  for (let i = 0; i < arr.length; i++) {
    if (isSame(arr[i], item)) {
      arr.splice(i, 1)
    }
  }
}
