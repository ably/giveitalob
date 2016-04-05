/* jshint esnext: true */

export default function ConsoleView(logger){
  this.render = function(projection){
    logger.info(projection);
  };
}
