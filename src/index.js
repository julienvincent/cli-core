import minimist from 'minimist'
import _ from 'lodash'
import { getLogger as logger } from './utils'

_.extractObject = array => {
    let result = {}
    _.forEach(array, command => result = {
        ...result,
        ...command
    })

    return result
}

export const args = minimist(process.argv.slice(2))

const sequence = args._
const found = []
let commands = {}
const availableFlags = []
let helpText = 'Simple-cli help text\n'

export const command = (name, man, action, ...chained) => {
    man = man || ''
    action = action || function () {
        }
    if (typeof action === 'object') {
        chained = [...chained, ...[action]]
        action = function () {
        }
    }

    if (typeof man === 'function') {
        action = man
        man = ''
    }

    return {
        [name]: {
            man: man,
            action: action,
            commands: _.extractObject(chained)
        }
    }
}

export const option = option => {
    return _.find(args, (value, key) => key == option)
}

export const getUnusedOptions = () => {
    return _.filter(process.argv, argument => argument.substring(0, 2) == '--' && !_.find(availableFlags, flag => flag.indexOf(argument) !== -1))
}

export const define = (...definitions) => {
    _.forEach(definitions, definition => {
        commands = {
            ...commands,
            ...definition
        }
    })

    return commands
}

/**
 * A hack to let help know what options are available
 */
export const flags = (...flags) => availableFlags.push(...flags)

export const setHelpText = text => helpText = text
export const help = () => {
    const createdChain = []
    const listCommands = (chain, commands) => {
        if (typeof chain === 'string' || !chain.length) {
            const list = commands => _.forIn(commands, (value, key) => {
                createdChain.push([` - ${key}`, value.man])
            })

            if (!chain.length) {
                list(commands)
            } else {
                list(commands[chain].commands)
            }
        } else {
            const nextInChain = chain[0]
            const command = _.find(commands, (value, key) => key == nextInChain)

            if (command) {
                if (chain.length == 2) {
                    listCommands(chain[1], command.commands)
                } else {
                    listCommands(_.without(chain, nextInChain), command.commands)
                }
            } else {
                console.log(`\nError: Unknown command ${nextInChain}`)
            }
        }
    }

    console.log(helpText)

    if (!found.length) {
        console.log('Available commands:')
    } else {
        console.log(`Command [${found[found.length - 1]}]:\n`)
        console.log('man')
    }
    listCommands(found, commands)

    logger(['', ''])(...createdChain)

    if (availableFlags.length && !found.length) {
        console.log('\nAvailable flags:')
        logger(['', ''])(...availableFlags)
    } else {
        console.log('')
    }
}

const nextCommand = (commands, index = 0) => {
    if (!sequence.length || option('h') || option('help')) {
        if (sequence[index]) {
            found.push(sequence[index])
        }

        return {
            action: help,
            next: null
        }
    } else {
        const command = _.find(commands, (value, key) => key == sequence[index] || key.substring(0, 1) == ':' || _.find(_.split(key, '|'), key => key == sequence[index]))

        if (command) {
            found.push(sequence[index])
            index++

            const name = _.join(_.map(_.pickBy(commands, _command => _command == command), (_command, key) => key))
            const args = []

            if (name.indexOf(']') !== -1) {
                for (let i = index; i < sequence.length; i++) {
                    if (sequence[i]) {
                        found.push(sequence[i])
                        args.push(sequence[i])
                    }
                }
            }

            return {
                action: command.action.bind(this, sequence[index - 1]),
                next: !_.isEmpty(command.commands) && sequence.length >= index + 1 ? nextCommand(command.commands, index) : null,
                args
            }
        } else {
            throw new Error(`Unknown command ${sequence[index]}`)
        }
    }
}

export const init = () => {
    let chain;
    try {
        chain = nextCommand(commands)

        if (_.difference(sequence, found).length) {
            throw new Error(`Unknown command ${difference[0]}`)
        }
    } catch (e) {
        console.log(`${e}\n\n`)
        help()
    }

    const run = (command, param) => {
        const res = command.action(param, command.args)
        let payload = res,
            action = res

        if (typeof res === 'object') {
            payload = res.payload
            action = res.action
        }

        if (command.next) {
            run(command.next, payload)
        } else {
            if (action) {
                if (typeof action === 'function') {
                    action()
                } else {
                    console.log(action)
                }
            }
        }
    }

    run(chain)
}