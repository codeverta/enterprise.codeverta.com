package common

import "testing"

func TestQueueEmailJobReturnsErrorWhenRedisDisabled(t *testing.T) {
	oldRedisEnabled := RedisEnabled
	oldRDB := RDB
	RedisEnabled = false
	RDB = nil
	defer func() {
		RedisEnabled = oldRedisEnabled
		RDB = oldRDB
	}()

	err := QueueEmailJob("from@example.com", "to@example.com", "Subject", 123, map[string]string{"OrderID": "ORDER1"})
	if err == nil {
		t.Fatal("expected error when redis is disabled")
	}
}

func TestQueueEmailJobReturnsErrorWhenRedisClientNil(t *testing.T) {
	oldRedisEnabled := RedisEnabled
	oldRDB := RDB
	RedisEnabled = true
	RDB = nil
	defer func() {
		RedisEnabled = oldRedisEnabled
		RDB = oldRDB
	}()

	err := QueueEmailJob("from@example.com", "to@example.com", "Subject", 123, map[string]string{"OrderID": "ORDER1"})
	if err == nil {
		t.Fatal("expected error when redis client is nil")
	}
}

func TestQueueSuccessEmailPropagatesQueueErrors(t *testing.T) {
	oldRedisEnabled := RedisEnabled
	oldRDB := RDB
	RedisEnabled = false
	RDB = nil
	defer func() {
		RedisEnabled = oldRedisEnabled
		RDB = oldRDB
	}()

	err := QueueSuccessEmail("from@example.com", "to@example.com", PaymentSuccessEmailData{OrderID: "ORDER1"}, 123)
	if err == nil {
		t.Fatal("expected QueueSuccessEmail to return queue error")
	}
}
