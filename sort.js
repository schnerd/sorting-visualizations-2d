'use strict';

function color(x, width) {
  return d3.interpolateViridis(x / width);
}

function shuffle(array, start, end) {
  var m = end - start;
  while (m) {
    var i = Math.floor(random() * m--);
    var tmp = array[start + m];
    array[start + m] = array[start + i];
    array[start + i] = tmp;
  }
}

var SG_MAGICCONST = 1.0 + Math.log(4.5);
var LOG4 = Math.log(4.0);

function gamma_distribution(alpha, beta) {
  if (alpha > 1) {
    var ainv = Math.sqrt(2.0 * alpha - 1.0);
    var bbb = alpha - LOG4;
    var ccc = alpha + ainv;

    while (true) {
      var u1 = Math.random();
      if (1e-7 > u1 || u1 > 0.9999999) {
        continue;
      }
      var u2 = 1.0 - Math.random();
      var v = Math.log(u1 / (1.0 - u1)) / ainv;
      var x = alpha * Math.exp(v);
      var z = u1 * u1 * u2;
      var r = bbb + ccc * v - x;
      if (r + SG_MAGICCONST - 4.5 * z >= 0.0 || r >= Math.log(z)) {
        return x * beta;
      }
    }
  } else if (alpha === 1.0) {
    do {
      var u = Math.random();
    } while (u <= 1e-7);
    return -Math.log(u) * beta;
  } else {
    while (true) {
      var u = Math.random();
      var b = (Math.E + alpha) / Math.E;
      var p = b * u;
      if (p <= 1.0) {
        x = Math.pow(p, 1.0 / alpha);
      } else {
        x = -Math.log((b - p) / alpha);
      }
      var u1 = Math.random();
      if (p > 1.0) {
        if (u1 <= Math.pow(x, alpha - 1.0)) {
          break;
        }
      } else if (u1 <= Math.exp(-x)) {
        break;
      }
    }
    return x * beta;
  }
}

function beta_distribution(alpha, beta) {
  var y = gamma_distribution(alpha, 1);
  if (y === 0) {
    return 0.0;
  } else {
    return y / (y + gamma_distribution(beta, 1));
  }
}

function random() {
  do {
    var ret = beta_distribution(
      options.distribution.alpha,
      options.distribution.beta,
    );
  } while (ret >= 1);
  return ret;
}

function SortingVisualization(data, options, ctx) {
  this.original_data = [];
  this.swaps = [];
  for (var i = 0; i < data.length; i++) {
    this.original_data.push(data[i].slice());
    this.swaps.push([]);
  }

  this.data = data;
  this.captures = [];

  this.options = options;
  this.ctx = ctx;
}

SortingVisualization.prototype.cmp = function(x, y) {
  return x < y;
};

SortingVisualization.prototype.swap = function(y, x1, x2) {
  var temp = this.data[y][x1];
  this.data[y][x1] = this.data[y][x2];
  this.data[y][x2] = temp;

  this.swaps[y].push([x1, x2]);
};

SortingVisualization.prototype.sort_end = function() {
  for (var y = 0; y < this.swaps.length; y++) {
    this.swaps[y].reverse();
  }

  this.data = this.original_data;
};

SortingVisualization.prototype.step = function() {
  var swapped = false;
  var zoom = this.options.zoom;

  for (var y = 0; y < this.swaps.length; y++) {
    if (this.swaps[y].length) {
      swapped = true;

      var step = this.swaps[y].pop();
      var x1 = step[0],
        x2 = step[1];

      var temp = this.original_data[y][x1];
      this.original_data[y][x1] = this.original_data[y][x2];
      this.original_data[y][x2] = temp;

      this.ctx.fillStyle = color(
        this.original_data[y][x1],
        this.original_data[y].length,
      );
      this.ctx.fillRect(x1 * zoom, y * zoom, zoom, zoom);

      this.ctx.fillStyle = color(
        this.original_data[y][x2],
        this.original_data[y].length,
      );
      this.ctx.fillRect(x2 * zoom, y * zoom, zoom, zoom);
    }
  }

  return !swapped;
};

SortingVisualization.prototype.pivot = function(y, left, right) {
  if (options.pivot === 'Start') {
    return left;
  } else if (options.middle === 'Middle') {
    return left + Math.floor((right - left) / 2);
  } else if (options.pivot === 'End') {
    return right;
  } else if (options.pivot === 'Random') {
    return left + Math.floor(random() * (right - left));
  }
};

function NonSwappingSortingVisualization() {
  SortingVisualization.apply(this, arguments);
  this.stack = [];
  for (var i = 0; i < this.data.length; i++) {
    this.stack.push([]);
  }
}

NonSwappingSortingVisualization.prototype = Object.create(
  SortingVisualization.prototype,
);
NonSwappingSortingVisualization.prototype.constructor = SortingVisualization;

NonSwappingSortingVisualization.prototype.sort_end = function() {
  SortingVisualization.prototype.sort_end.apply(this, arguments);
  for (var y = 0; y < this.stack.length; y++) {
    this.stack[y].reverse();
  }

  this.data = this.original_data;
  draw(this.ctx, this.data, false);
};

NonSwappingSortingVisualization.prototype.step = function(have_to_draw) {
  for (var y = 0; y < this.stack.length; y++) {
    if (!this.stack[y].length) {
      draw(this.ctx, this.data, false);
      return true;
    }

    var data = this.stack[y].pop();
    var left = data[0],
      result = data[1];

    for (var i = 0; i < result.length; i++) {
      this.data[y][left + i] = result[i];
    }
  }

  if (have_to_draw) {
    draw(this.ctx, this.data, false);
  }

  return false;
};

function BubbleSort() {
  SortingVisualization.apply(this, arguments);
}

BubbleSort.prototype = Object.create(SortingVisualization.prototype);
BubbleSort.prototype.constructor = SortingVisualization;

BubbleSort.prototype.sort = function(y, left, right) {
  for (; left <= right; left++) {
    for (var x = left; x <= right; x++) {
      if (this.cmp(this.data[y][x], this.data[y][left])) {
        this.swap(y, left, x);
      }
    }
  }
};

function InsertionSort() {
  SortingVisualization.apply(this, arguments);
}

InsertionSort.prototype = Object.create(SortingVisualization.prototype);
InsertionSort.prototype.constructor = SortingVisualization;

InsertionSort.prototype.sort = function(y, left, right) {
  for (; left <= right; left++) {
    var j = left;
    while (j > 0 && this.cmp(this.data[y][j], this.data[y][j - 1])) {
      this.swap(y, j, j - 1);
      j--;
    }
  }
};

function StoogeSort() {
  SortingVisualization.apply(this, arguments);
}

StoogeSort.prototype = Object.create(SortingVisualization.prototype);
StoogeSort.prototype.constructor = SortingVisualization;

StoogeSort.prototype.sort = function(y, left, right) {
  if (this.cmp(this.data[y][right], this.data[y][left])) {
    this.swap(y, left, right);
  }

  if (right - left >= 2) {
    var t = Math.round((right - left) / 3);
    this.sort(y, left, right - t);
    this.sort(y, left + t, right);
    this.sort(y, left, right - t);
  }
};

function SelectionSort() {
  SortingVisualization.apply(this, arguments);
}

SelectionSort.prototype = Object.create(SortingVisualization.prototype);
SelectionSort.prototype.constructor = SortingVisualization;

SelectionSort.prototype.sort = function(y, left, right) {
  for (; left <= right; left++) {
    var min_i = left;
    for (var i = left + 1; i <= right; i++) {
      if (this.cmp(this.data[y][i], this.data[y][min_i])) {
        min_i = i;
      }
    }
    this.swap(y, left, min_i);
  }
};

function CocktailSort() {
  SortingVisualization.apply(this, arguments);
}

CocktailSort.prototype = Object.create(SortingVisualization.prototype);
CocktailSort.prototype.constructor = SortingVisualization;

CocktailSort.prototype.sort = function(y, left, right) {
  var swapped = true;
  while (swapped) {
    swapped = false;
    for (var i = left; i < right - 1; i++) {
      if (this.cmp(this.data[y][i + 1], this.data[y][i])) {
        this.swap(y, i, i + 1);
        swapped = true;
      }
    }
    if (!swapped) {
      break;
    }
    swapped = false;
    for (var i = right - 1; i >= 0; i--) {
      if (this.cmp(this.data[y][i + 1], this.data[y][i])) {
        this.swap(y, i, i + 1);
        swapped = true;
      }
    }
  }
};

function OddEvenSort() {
  SortingVisualization.apply(this, arguments);
}

OddEvenSort.prototype = Object.create(SortingVisualization.prototype);
OddEvenSort.prototype.constructor = SortingVisualization;

OddEvenSort.prototype.sort = function(y, left, right) {
  var sorted = false;
  while (!sorted) {
    sorted = true;
    for (var i = left + 1; i < right; i += 2) {
      if (this.cmp(this.data[y][i + 1], this.data[y][i])) {
        this.swap(y, i, i + 1);
        sorted = false;
      }
    }

    for (var i = left; i < right; i += 2) {
      if (this.cmp(this.data[y][i + 1], this.data[y][i])) {
        this.swap(y, i, i + 1);
        sorted = false;
      }
    }
  }
};

function ShellSort() {
  SortingVisualization.apply(this, arguments);
}

ShellSort.prototype = Object.create(SortingVisualization.prototype);
ShellSort.prototype.constructor = SortingVisualization;

ShellSort.prototype.sort = function(y, left, right) {
  var gaps = [701, 301, 132, 57, 23, 10, 4, 1];

  for (var k = 0; k < gaps.length; k++) {
    var gap = gaps[k];
    for (var i = gap; i <= right; i++) {
      var temp = this.data[y][i];
      for (
        var j = i;
        j >= gap && this.cmp(temp, this.data[y][j - gap]);
        j -= gap
      ) {
        this.swap(y, j, j - gap);
      }
      //this.data[y][j] = temp;
    }
  }
};

function CombSort() {
  SortingVisualization.apply(this, arguments);
}

CombSort.prototype = Object.create(SortingVisualization.prototype);
CombSort.prototype.constructor = SortingVisualization;

CombSort.prototype.sort = function(y, left, right) {
  var gap = right - left;
  var sorted = false;

  while (!sorted) {
    gap = Math.max(Math.floor(gap / options.shrink_factor), 1);
    sorted = gap === 1;

    for (var i = left; i + gap <= right; i++) {
      if (this.cmp(this.data[y][i + gap], this.data[y][i])) {
        sorted = false;
        this.swap(y, i, i + gap);
      }
    }
  }
};

function QuickSort() {
  SortingVisualization.apply(this, arguments);
}

QuickSort.prototype = Object.create(SortingVisualization.prototype);
QuickSort.prototype.constructor = SortingVisualization;

QuickSort.prototype.partition = function(y, pivot, left, right) {
  var store_index = left,
    pivot_value = this.data[y][pivot];

  this.swap(y, pivot, right);

  for (var v = left; v < right; v++) {
    if (this.cmp(this.data[y][v], pivot_value)) {
      this.swap(y, v, store_index++);
    }
  }

  this.swap(y, right, store_index);

  return store_index;
};

QuickSort.prototype.sort = function(y, left, right) {
  if (left > right) {
    return;
  }

  var pivot = this.pivot(y, left, right);
  var new_pivot = this.partition(y, pivot, left, right);

  this.sort(y, left, new_pivot - 1);
  this.sort(y, new_pivot + 1, right);
};

function MergeSort() {
  NonSwappingSortingVisualization.apply(this, arguments);
}

MergeSort.prototype = Object.create(NonSwappingSortingVisualization.prototype);
MergeSort.prototype.constructor = NonSwappingSortingVisualization;

MergeSort.prototype.merge = function(
  y,
  left_start,
  left_end,
  right_start,
  right_end,
) {
  var result = [];

  while (left_start <= left_end || right_start <= right_end) {
    if (left_start <= left_end && right_start <= right_end) {
      if (this.cmp(this.data[y][left_start], this.data[y][right_start])) {
        result.push(this.data[y][left_start++]);
      } else {
        result.push(this.data[y][right_start++]);
      }
    } else if (left_start <= left_end) {
      result.push(this.data[y][left_start++]);
    } else {
      result.push(this.data[y][right_start++]);
    }
  }

  return result;
};

MergeSort.prototype.sort = function(y, left, right) {
  if (right > left) {
    var mid = Math.floor((right + left) / 2);
    this.sort(y, left, mid);
    this.sort(y, mid + 1, right);
    var merge = this.merge(y, left, mid, mid + 1, right);
    for (var i = 0; i < merge.length; i++) {
      this.data[y][left + i] = merge[i];
      this.stack[y].push([left + i, [merge[i]]]);
    }
  }
};

function HeapSort() {
  SortingVisualization.apply(this, arguments);
}

HeapSort.prototype = Object.create(SortingVisualization.prototype);
HeapSort.prototype.constructor = SortingVisualization;

HeapSort.prototype.max_heapify = function(y, i, length) {
  while (true) {
    var left = i * 2 + 1;
    var right = i * 2 + 2;
    var largest = i;

    if (left < length && this.cmp(this.data[y][largest], this.data[y][left])) {
      largest = left;
    }

    if (
      right < length &&
      this.cmp(this.data[y][largest], this.data[y][right])
    ) {
      largest = right;
    }

    if (i === largest) {
      break;
    }

    this.swap(y, i, largest);
    i = largest;
  }
};

HeapSort.prototype.heapify = function(y, length) {
  for (var i = Math.floor(length / 2); i >= 0; i--) {
    this.max_heapify(y, i, length);
  }
};

HeapSort.prototype.sort = function(y, left, right) {
  this.heapify(y, right);

  for (var i = right; i > 0; i--) {
    this.swap(y, i, 0);
    this.max_heapify(y, 0, i - 1);
  }
};

function RadixSort() {
  NonSwappingSortingVisualization.apply(this, arguments);
}

RadixSort.prototype = Object.create(NonSwappingSortingVisualization.prototype);
RadixSort.prototype.constructor = NonSwappingSortingVisualization;

RadixSort.prototype.sort = function(y, left, right) {
  var data = this.data[y];

  var maxval = Math.max.apply(null, this.data[y].slice(left, right + 1));

  var it = 0;
  while (Math.pow(this.options.base, it) <= maxval) {
    var buckets = [];
    for (var i = 0; i < this.options.base; i++) {
      buckets.push([]);
    }

    for (var i = left; i <= right; i++) {
      var digit =
        Math.floor(data[i] / Math.pow(this.options.base, it)) %
        this.options.base;
      buckets[digit].push(data[i]);
    }

    data = [];
    var start = left;
    for (var i = 0; i < buckets.length; i++) {
      for (var j = 0; j < buckets[i].length; j++) {
        data.push(buckets[i][j]);
        this.stack[y].push([start++, [buckets[i][j]]]);
      }
    }

    it++;
  }
};

var options;

var desiredCaptures = 100;
var canvas, ctx;
var canvas2, ctx2;

function draw(ctx, data, resize) {
  if (resize) {
    canvas.width = options.width * options.zoom;
    canvas.height = options.height * options.zoom;

    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';

    canvas2.width = canvas.width;
    canvas2.height = desiredCaptures * options.zoom;
    canvas2.style.width = canvas2.width + 'px';
    canvas2.style.height = canvas2.height + 'px';
    ctx2.fillStyle = '#cccccc';
    ctx2.fillRect(0, 0, canvas2.width, canvas2.height);
  }

  for (var y = 0; y < data.length; y++) {
    for (var x = 0; x < data[y].length; x++) {
      ctx.fillStyle = color(data[y][x], options.width);
      ctx.fillRect(
        x * options.zoom,
        y * options.zoom,
        options.zoom,
        options.zoom,
      );
    }
  }
}

document.addEventListener('DOMContentLoaded', function() {
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');

  canvas2 = document.getElementById('canvas-2');
  ctx2 = canvas2.getContext('2d');
  document.getElementById('canvas-2-dl').addEventListener(
    'click',
    function() {
      var dt = canvas2.toDataURL('image/png');
      this.href = dt;
    },
    false,
  );

  var processing = false;

  var data, sort_visualization;

  var algorithms = {
    'Bubble sort': BubbleSort,
    'Insertion sort': InsertionSort,
    'Stooge sort': StoogeSort,
    'Selection sort': SelectionSort,
    'Cocktail sort': CocktailSort,
    'Odd-even sort': OddEvenSort,
    'Shell sort': ShellSort,
    'Comb sort': CombSort,
    'Quick sort': QuickSort,
    'Heap sort': HeapSort,
    'Radix sort': RadixSort,
    'Merge sort': MergeSort,
  };

  options = {
    width: 100,
    height: 1,
    speed: 1,
    algorithm: 'Bubble sort',
    pivot: 'Start',
    shrink_factor: 1.3,
    base: 2,
    generate: 'Increasing',
    shuffle: function() {
      for (var y = 0; y < data.length; y++) {
        shuffle(data[y], 0, data[y].length);
      }
      draw(ctx, data, false);
    },
    zoom: 4,
    start: function() {
      options.shuffle();
      hide_gui_element('shuffle', true);
      hide_gui_element('start', true);
      hide_gui_element('stop', false);

      processing = true;

      var algorithm = algorithms[options.algorithm];
      sort_visualization = new algorithm(data, options, ctx);

      options.capture();

      for (var y = 0; y < options.height; y++) {
        sort_visualization.sort(y, 0, options.width - 1);
      }
      sort_visualization.sort_end();

      var currentFrame = 1;
      var totalFrames = d3.max(
        sort_visualization.stack || sort_visualization.swaps,
        swap => swap.length,
      );
      var scale = d3
        .scaleLinear()
        .domain([0, desiredCaptures - 1])
        .range([0, totalFrames]);
      var captureFrames = d3
        .range(1, desiredCaptures)
        .map(scale)
        .map(Math.round);

      function step() {
        if (!processing) {
          return;
        }
        for (var i = 0, done; i < options.speed; i++) {
          done = sort_visualization.step(i === options.speed - 1);

          if (captureFrames[0] === currentFrame) {
            captureFrames.shift();
            options.capture();
          }
          currentFrame++;

          if (done) {
            options.stop();
            return;
          }
        }
        requestAnimationFrame(step);
      }

      step();
    },
    stop: function() {
      hide_gui_element('shuffle', false);
      hide_gui_element('start', false);
      hide_gui_element('stop', true);

      data = sort_visualization.data;

      options.renderCaptures();

      processing = false;
    },
    capture: function() {
      sort_visualization.captures.push(
        ctx.getImageData(0, 0, canvas.width, canvas.height),
      );
    },
    renderCaptures: function() {
      var newCaptures = sort_visualization.captures;
      var renderHeight = Math.floor(canvas2.height / desiredCaptures);

      // Changes rendering algorithm
      var alwaysRenderFirstRow = true;

      for (var i = 0; i < newCaptures.length; i++) {
        if (alwaysRenderFirstRow) {
          ctx2.putImageData(
            newCaptures[i],
            0, // dx,
            i * renderHeight, // dy,
            0, // dirtyX, - dest x pos
            0, // dirtyY, - dest y pos
            canvas2.width, // dirtyWidth,
            renderHeight * options.zoom, // dirtyHeight
          );
        } else {
          ctx2.putImageData(
            newCaptures[i],
            0, // dx,
            0, // dy,
            0, // dirtyX, - dest x pos
            i * renderHeight, // dirtyY, - dest y pos
            canvas2.width, // dirtyWidth,
            renderHeight, // dirtyHeight
          );
        }
      }
    },
    distribution: {
      alpha: 1,
      beta: 1,
    },
  };

  function resize() {
    if (processing) {
      return;
    }

    data = [];
    for (var y = 0; y < options.height; y++) {
      data.push([]);
      if (options.generate === 'Increasing') {
        for (var x = 0; x < options.width; x++) {
          data[y].push(x);
        }
      } else if (options.generate === 'Decreasing') {
        for (var x = options.width - 1; x >= 0; x--) {
          data[y].push(x);
        }
      }
    }

    draw(ctx, data, true);
  }

  resize();

  var gui = new dat.GUI();
  gui
    .add(options, 'width', 1, window.innerWidth, 1)
    .name('Width')
    .onChange(resize);
  gui
    .add(options, 'height', 1, window.innerHeight, 1)
    .name('Height')
    .onChange(resize);
  gui.add(options, 'speed', 1, 25, 1).name('Speed');
  gui
    .add(options, 'algorithm', Object.keys(algorithms))
    .name('Algorithm')
    .onChange(function() {
      hide_gui_element('pivot', options.algorithm !== 'Quick sort');
      hide_gui_element('shrink_factor', options.algorithm !== 'Comb sort');
      hide_gui_element('base', options.algorithm !== 'Radix sort');
    });
  gui.add(options, 'pivot', ['Start', 'Middle', 'End', 'Random']).name('Pivot');
  gui.add(options, 'shrink_factor', 1.001, 3).name('Shrink factor');
  gui.add(options, 'base', 2, 10, 1).name('Base');
  gui
    .add(options, 'generate', ['Increasing', 'Decreasing'])
    .name('Generate')
    .onChange(resize);
  gui.add(options, 'shuffle').name('Shuffle');
  gui.add(options, 'zoom', 1, 50, 1).name('Zoom').onChange(function() {
    draw(ctx, data, true);
  });
  gui.add(options, 'start').name('Start');
  gui.add(options, 'stop').name('Stop');

  var distribution_folder = gui.addFolder('Beta distribution');
  distribution_folder.add(options.distribution, 'alpha', 0.01).name('Alpha');
  distribution_folder.add(options.distribution, 'beta', 0.01).name('Beta');

  var hide_gui_element = function(property, hide) {
    for (var i = 0; i < gui.__controllers.length; i++) {
      var controller = gui.__controllers[i];
      if (controller.property === property) {
        controller.domElement.parentElement.parentElement.hidden = hide;
        return;
      }
    }
  };

  hide_gui_element('stop', true);
  hide_gui_element('pivot', true);
  hide_gui_element('shrink_factor', true);
  hide_gui_element('base', true);
});
