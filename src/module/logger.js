/**
 * @file A simple wrapper around the loglevel library for structured logging.
 */
import log from "loglevel";

const logger = log.getLogger("ose");
logger.setLevel("warn"); // Default to only showing warnings and errors.

export default logger;