#!/bin/bash
# wait-for-it.sh: Wait for a service to be available
# Usage: ./wait-for-it.sh host:port [-t timeout] [-- command args]

WAITFORIT_cmdname=${0##*/}

# Default timeout is 15 seconds
WAITFORIT_TIMEOUT=15
WAITFORIT_QUIET=0
WAITFORIT_HOST=""
WAITFORIT_PORT=""
WAITFORIT_RESULT=0
WAITFORIT_STRICT=0

function usage {
    cat << USAGE >&2
Usage:
    $WAITFORIT_cmdname host:port [-t timeout] [-- command args]
    -t TIMEOUT                  Timeout in seconds, zero for no timeout
    -- COMMAND ARGS             Execute command with args after the test finishes
USAGE
    exit 1
}

function wait_for {
    if [[ $WAITFORIT_TIMEOUT -gt 0 ]]; then
        echo "Waiting up to $WAITFORIT_TIMEOUT seconds for $WAITFORIT_HOST:$WAITFORIT_PORT to be available"
    else
        echo "Waiting for $WAITFORIT_HOST:$WAITFORIT_PORT without a timeout"
    fi
    
    WAITFORIT_start_ts=$(date +%s)
    while :
    do
        (echo > /dev/tcp/$WAITFORIT_HOST/$WAITFORIT_PORT) >/dev/null 2>&1
        WAITFORIT_result=$?
        if [[ $WAITFORIT_result -eq 0 ]]; then
            WAITFORIT_end_ts=$(date +%s)
            echo "$WAITFORIT_HOST:$WAITFORIT_PORT is available after $((WAITFORIT_end_ts - WAITFORIT_start_ts)) seconds"
            break
        fi
        sleep 1
        
        WAITFORIT_CURRENT_TS=$(date +%s)
        if [[ $WAITFORIT_TIMEOUT -gt 0 && $((WAITFORIT_CURRENT_TS - WAITFORIT_start_ts)) -ge $WAITFORIT_TIMEOUT ]]; then
            echo "Timeout occurred after waiting $WAITFORIT_TIMEOUT seconds for $WAITFORIT_HOST:$WAITFORIT_PORT"
            WAITFORIT_RESULT=1
            break
        fi
    done
    return $WAITFORIT_RESULT
}

# Process arguments
while [[ $# -gt 0 ]]
do
    case "$1" in
        *:* )
        WAITFORIT_HOST=$(printf "%s\n" "$1"| cut -d : -f 1)
        WAITFORIT_PORT=$(printf "%s\n" "$1"| cut -d : -f 2)
        shift 1
        ;;
        -t)
        WAITFORIT_TIMEOUT="$2"
        if [[ $WAITFORIT_TIMEOUT == "" ]]; then break; fi
        shift 2
        ;;
        --)
        shift
        WAITFORIT_CLI=("$@")
        break
        ;;
        *)
        usage
        ;;
    esac
done

if [[ "$WAITFORIT_HOST" == "" || "$WAITFORIT_PORT" == "" ]]; then
    usage
fi

wait_for
WAITFORIT_RESULT=$?

if [[ $WAITFORIT_RESULT -ne 0 && $WAITFORIT_STRICT -eq 1 ]]; then
    exit $WAITFORIT_RESULT
fi

if [[ ${#WAITFORIT_CLI[@]} -gt 0 ]]; then
    exec "${WAITFORIT_CLI[@]}"
else
    exit $WAITFORIT_RESULT
fi