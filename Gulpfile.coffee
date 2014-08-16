gulp = require("gulp")
plumber = require("gulp-plumber")
coffee = require("gulp-coffee")

paths =
  coffee: './source/**/*.coffee'

gulp.task "coffee", (cb) ->
  gulp.src(paths.coffee)
    .pipe(plumber())
    .pipe(coffee(bare: true))
    .pipe(gulp.dest('./build/'))
    .on "end", ->
      console.log "Done compiling Coffeescript!"


# Rerun the task when a file changes
gulp.task "watch", ->
  gulp.watch paths.coffee, ["coffee"]

gulp.task "default", [
  "coffee"
]
