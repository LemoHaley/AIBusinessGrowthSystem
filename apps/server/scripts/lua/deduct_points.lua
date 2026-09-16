-- 积分原子扣减（plan.md 第 7.2 节，防超发）
-- KEYS[1]: points:balance:{tenantId}:{userId}
-- KEYS[2]: points:lock:{bizId}
-- ARGV[1]: 扣减数量（正整数）
-- ARGV[2]: 幂等锁过期时间（秒）
--
-- 返回值：扣减后余额；-1 余额不足；-2 重复请求

-- 幂等检查：同 bizId 只扣一次
if redis.call('EXISTS', KEYS[2]) == 1 then
    return -2
end

local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local delta = tonumber(ARGV[1])

-- 余额校验：不足直接拒绝
if current < delta then
    return -1
end

-- 原子扣减 + 写幂等锁
redis.call('DECRBY', KEYS[1], delta)
redis.call('SET', KEYS[2], '1', 'EX', tonumber(ARGV[2]))

return current - delta
